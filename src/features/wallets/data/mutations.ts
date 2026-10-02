import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import { SETTINGS_KEY } from '#/db/types'
import type {
  LocalBalanceNode,
  LocalBalanceSettings,
  OutboxEntry,
} from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type {
  NodeKind,
  PlanningSettings,
} from '#/features/wallets/api/types'
import { hasArchivedAncestor } from './archive'
import { freeSetAsidesUnder } from './heldMoney'
import {
  localNodeToCreateWire,
  localNodeToUpdateWire,
  localSettingsToUpdateWire,
  normalizedPlanning,
  planningSettingsOf,
} from './mappers'

export type NodeDraft = {
  kind: NodeKind
  name: string
  color: string
  icon?: string | null
  note: string | null
  parentId: string | null
  amount: number | null
  currency: CurrencyCode | null
}

export type NodePatch = Partial<Omit<NodeDraft, 'kind'>> & {
  collapsed?: boolean
  position?: number
  archivedAt?: string | null
}

const now = () => new Date().toISOString()
const liveNodes = async (): Promise<LocalBalanceNode[]> =>
  (await db.balanceNodes.toArray()).filter((n) => n.deleted === 0)

async function nextPosition(parentId: string | null): Promise<number> {
  const siblings = (await liveNodes()).filter((n) => n.parentId === parentId)
  return siblings.reduce((max, n) => Math.max(max, n.position), -1) + 1
}

// --- Outbox helpers ------------------------------------------------------------------

const pending = (entity: 'node' | 'settings', id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

async function enqueueNodeUpsert(node: LocalBalanceNode): Promise<void> {
  const entries = await pending('node', node.id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    // Never synced yet — keep it a create, just refresh the payload.
    create.payload = localNodeToCreateWire(node)
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  const payload = localNodeToUpdateWire(node)
  if (update) {
    update.payload = payload
    update.baseVersion = node.version
    await db.outbox.put(requeued(update))
    return
  }
  await db.outbox.add({
    op: 'update',
    entity: 'node',
    id: node.id,
    payload,
    baseVersion: node.version,
    createdAt: now(),
  })
}

// --- Public mutations ----------------------------------------------------------------

export async function createNode(draft: NodeDraft): Promise<string> {
  return createNodeWithId(newId(), draft)
}

/**
 * Create a node under a caller-supplied id. The importer mints wallet ids while mapping, so
 * every row carries its final account before anything is written; idempotent, so a retried
 * commit adds nothing twice.
 */
export async function createNodeWithId(
  id: string,
  draft: NodeDraft,
): Promise<string> {
  if (await db.balanceNodes.get(id)) return id
  const ts = now()
  const node: LocalBalanceNode = {
    id,
    kind: draft.kind,
    parentId: draft.parentId,
    name: draft.name,
    color: draft.color,
    icon: draft.icon ?? null,
    note: draft.note,
    position: await nextPosition(draft.parentId),
    collapsed: false,
    archivedAt: null,
    amount: draft.kind === 'wallet' ? draft.amount : null,
    currency: draft.kind === 'wallet' ? draft.currency : null,
    createdAt: ts,
    updatedAt: ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
    await db.balanceNodes.put(node)
    await db.outbox.add({
      op: 'create',
      entity: 'node',
      id,
      payload: localNodeToCreateWire(node),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateNode(id: string, patch: NodePatch): Promise<void> {
  const existing = await db.balanceNodes.get(id)
  if (!existing) return

  const parentChanged =
    patch.parentId !== undefined && patch.parentId !== existing.parentId
  const position =
    patch.position ??
    (parentChanged
      ? await nextPosition(patch.parentId ?? null)
      : existing.position)

  const node: LocalBalanceNode = {
    ...existing,
    name: patch.name ?? existing.name,
    color: patch.color ?? existing.color,
    icon: patch.icon !== undefined ? patch.icon : existing.icon,
    note: patch.note !== undefined ? patch.note : existing.note,
    parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
    collapsed: patch.collapsed ?? existing.collapsed,
    archivedAt:
      patch.archivedAt !== undefined
        ? patch.archivedAt
        : (existing.archivedAt ?? null),
    amount:
      existing.kind === 'wallet' && patch.amount !== undefined
        ? patch.amount
        : existing.amount,
    currency:
      existing.kind === 'wallet' && patch.currency !== undefined
        ? patch.currency
        : existing.currency,
    position,
    updatedAt: now(),
    dirty: 1,
  }

  await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
    await db.balanceNodes.put(node)
    await enqueueNodeUpsert(node)
  })
  schedulePush()
}

export async function archiveNode(id: string): Promise<void> {
  await updateNode(id, { archivedAt: now() })
}

/**
 * Bring an archived node back. Inside a group that is itself still archived it would stay
 * hidden, so it comes back at the top level instead.
 */
export async function restoreNode(id: string): Promise<void> {
  const node = await db.balanceNodes.get(id)
  if (!node) return
  const stranded = hasArchivedAncestor(await liveNodes(), node)
  await updateNode(id, {
    archivedAt: null,
    ...(stranded ? { parentId: null } : {}),
  })
}

export async function toggleCollapse(id: string): Promise<void> {
  const node = await db.balanceNodes.get(id)
  if (!node) return
  await updateNode(id, { collapsed: !node.collapsed })
}

/** Delete a node and its subtree; what its wallets held set aside is freed first (03 §6). */
export async function deleteNode(id: string): Promise<void> {
  await freeSetAsidesUnder(id)
  const all = await liveNodes()
  const childrenOf = new Map<string | null, LocalBalanceNode[]>()
  for (const n of all) {
    const list = childrenOf.get(n.parentId) ?? []
    list.push(n)
    childrenOf.set(n.parentId, list)
  }

  const subtree: string[] = []
  const walk = (nodeId: string) => {
    subtree.push(nodeId)
    for (const child of childrenOf.get(nodeId) ?? []) walk(child.id)
  }
  walk(id)

  const rootEntries = await pending('node', id).toArray()
  const rootWasNeverSynced = rootEntries.some((e) => e.op === 'create')

  await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
    for (const nodeId of subtree) {
      await pending('node', nodeId).delete()
      await db.balanceNodes.delete(nodeId)
    }
    // The server cascade deletes descendants, so one delete for the root is enough — and
    // only if the root ever reached the server.
    if (!rootWasNeverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity: 'node',
        id,
        payload: null,
        baseVersion: null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}

export async function setBaseCurrency(code: CurrencyCode): Promise<void> {
  await updateSettingsRow((settings) => ({ ...settings, baseCurrency: code }))
}

/** Change any of the planning settings; the rest keep their stored values. */
export async function updatePlanningSettings(
  patch: Partial<PlanningSettings>,
): Promise<void> {
  await updateSettingsRow((settings) => ({
    ...settings,
    ...normalizedPlanning({ ...planningSettingsOf(settings), ...patch }),
  }))
}

/**
 * A deleted income stream stops being the main paycheck, as the server does on delete. Only a
 * queued PATCH naming it is rebuilt — otherwise the server's own change arrives with the pull.
 */
export async function forgetMainIncomeStream(streamId: string): Promise<void> {
  await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
    const settings = await db.balanceSettings.get(SETTINGS_KEY)
    if (settings?.mainIncomeStreamId !== streamId) return
    const next = { ...settings, mainIncomeStreamId: null }
    await db.balanceSettings.put(next)
    const queued = await pending('settings', SETTINGS_KEY).first()
    if (queued) {
      queued.payload = localSettingsToUpdateWire(next)
      await db.outbox.put(queued)
    }
  })
}

/**
 * Write the settings row and queue its PATCH. The PATCH is a full representation built from
 * the row, so a queued one is simply rebuilt.
 */
async function updateSettingsRow(
  change: (settings: LocalBalanceSettings) => LocalBalanceSettings,
): Promise<void> {
  const settings = await db.balanceSettings.get(SETTINGS_KEY)
  if (!settings) return

  const next: LocalBalanceSettings = {
    ...change(settings),
    updatedAt: now(),
    dirty: 1,
  }
  const payload = localSettingsToUpdateWire(next)

  await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
    await db.balanceSettings.put(next)
    const existing = await pending('settings', SETTINGS_KEY).first()
    if (existing) {
      existing.payload = payload
      await db.outbox.put(requeued(existing))
    } else {
      await db.outbox.add({
        op: 'update',
        entity: 'settings',
        id: SETTINGS_KEY,
        payload,
        baseVersion: settings.version,
        createdAt: now(),
      } satisfies OutboxEntry)
    }
  })
  schedulePush()
}
