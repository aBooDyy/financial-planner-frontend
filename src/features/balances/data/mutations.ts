import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { SETTINGS_KEY } from '#/db/types'
import type { LocalBalanceNode, OutboxEntry } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type { NodeKind } from '#/features/balances/api/types'
import { localNodeToCreateWire, localNodeToUpdateWire } from './mappers'

export type NodeDraft = {
  kind: NodeKind
  name: string
  color: string
  note: string | null
  parentId: string | null
  amount: number | null
  currency: CurrencyCode | null
}

export type NodePatch = Partial<Omit<NodeDraft, 'kind'>> & {
  collapsed?: boolean
  position?: number
}

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

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
    await db.outbox.put(create)
    return
  }
  const update = entries.find((e) => e.op === 'update')
  const payload = localNodeToUpdateWire(node)
  if (update) {
    update.payload = payload
    update.baseVersion = node.version
    await db.outbox.put(update)
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
  const id = newId()
  const ts = now()
  const node: LocalBalanceNode = {
    id,
    kind: draft.kind,
    parentId: draft.parentId,
    name: draft.name,
    color: draft.color,
    note: draft.note,
    position: await nextPosition(draft.parentId),
    collapsed: false,
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
    note: patch.note !== undefined ? patch.note : existing.note,
    parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
    collapsed: patch.collapsed ?? existing.collapsed,
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

export async function toggleCollapse(id: string): Promise<void> {
  const node = await db.balanceNodes.get(id)
  if (!node) return
  await updateNode(id, { collapsed: !node.collapsed })
}

export async function deleteNode(id: string): Promise<void> {
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
  const settings = await db.balanceSettings.get(SETTINGS_KEY)
  if (!settings) return

  const next = {
    ...settings,
    baseCurrency: code,
    updatedAt: now(),
    dirty: 1 as const,
  }
  const payload = { version: settings.version, base_currency: code }

  await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
    await db.balanceSettings.put(next)
    const existing = await pending('settings', SETTINGS_KEY).first()
    if (existing) {
      existing.payload = payload
      await db.outbox.put(existing)
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
