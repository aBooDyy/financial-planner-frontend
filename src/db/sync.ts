import { balancesApi } from '#/features/balances/api/balancesApi'
import type {
  CreateNodeWire,
  UpdateNodeWire,
} from '#/features/balances/api/types'
import {
  localNodeToUpdateWire,
  serverNodeToLocal,
  serverSettingsToLocal,
} from '#/features/balances/data/mappers'
import { pullGoalsAll, pushGoalsEntry } from '#/features/goals/data/sync'
import {
  pullCategories,
  pushSettingsEntry,
} from '#/features/settings/data/sync'
import {
  pullSpendingAll,
  pushSpendingEntry,
} from '#/features/transactions/data/sync'
import { ApiError } from '#/lib/apiError'
import { db } from './db'
import { SETTINGS_KEY } from './types'
import type { OutboxEntry } from './types'

const PUSH_DEBOUNCE_MS = 800
const SAFETY_FLUSH_MS = 30_000
const PULL_INTERVAL_MS = 300_000

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pushing = false
let pushQueued = false
let pulling = false

const isNetworkError = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 0
const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Push ----------------------------------------------------------------------------

/** Queue a debounced outbox flush after a local write. */
export function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushOutbox()
  }, PUSH_DEBOUNCE_MS)
}

async function pushOutbox(): Promise<void> {
  if (pushing) {
    pushQueued = true
    return
  }
  pushing = true
  try {
    // Drain in insertion order; stop on the first network failure to retry later.
    for (;;) {
      const entry = await db.outbox.orderBy('seq').first()
      if (!entry) break
      const drained = await pushEntry(entry)
      if (!drained) break
    }
  } finally {
    pushing = false
    if (pushQueued) {
      pushQueued = false
      schedulePush()
    }
  }
}

/** Returns true if the entry was handled (and removed), false to stop draining (network). */
async function pushEntry(entry: OutboxEntry): Promise<boolean> {
  try {
    if (entry.entity === 'settings') {
      await pushSettings(entry)
    } else if (
      entry.entity === 'income' ||
      entry.entity === 'goal' ||
      entry.entity === 'allocation'
    ) {
      await pushGoalsEntry(entry)
    } else if (
      entry.entity === 'transaction' ||
      entry.entity === 'budget' ||
      entry.entity === 'recurring'
    ) {
      await pushSpendingEntry(entry)
    } else if (entry.entity === 'category' || entry.entity === 'rate') {
      await pushSettingsEntry(entry)
    } else if (entry.op === 'create') {
      await pushNodeCreate(entry)
    } else if (entry.op === 'update') {
      await pushNodeUpdate(entry)
    } else {
      await pushNodeDelete(entry)
    }
    return true
  } catch (e) {
    if (isNetworkError(e)) return false
    // A non-network failure means the queued op can never succeed as-is; drop it and let a
    // pull restore canonical state rather than looping forever.
    await db.outbox.delete(entry.seq)
    return true
  }
}

async function pushNodeCreate(entry: OutboxEntry): Promise<void> {
  try {
    const node = await balancesApi.createNode(entry.payload as CreateNodeWire)
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(node))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      // Id already exists server-side — adopt the server copy.
      await db.outbox.delete(entry.seq)
      await pullNodes()
      return
    }
    throw e
  }
}

async function pushNodeUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const node = await balancesApi.updateNode(
      id,
      entry.payload as UpdateNodeWire,
    )
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(node))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) {
      await reapplyAfterConflict(entry)
      return
    }
    if (status === 404) {
      // Server deleted it; drop our update and the local record.
      await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
        await db.balanceNodes.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

/** Last-write-wins, client re-apply: rebase the local edit on the server version, retry once. */
async function reapplyAfterConflict(entry: OutboxEntry): Promise<void> {
  const fresh = (await balancesApi.listNodes()).find((n) => n.id === entry.id)
  const local = await db.balanceNodes.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  const rebased = { ...local, version: fresh.version }
  try {
    const node = await balancesApi.updateNode(
      entry.id,
      localNodeToUpdateWire(rebased),
    )
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(node))
      await db.outbox.delete(entry.seq)
    })
  } catch {
    // Still conflicting — accept the server copy and drop the op rather than loop.
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushNodeDelete(entry: OutboxEntry): Promise<void> {
  try {
    await balancesApi.deleteNode(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e // 404 ⇒ already gone, treat as success
  }
  await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
    await db.balanceNodes.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

async function pushSettings(entry: OutboxEntry): Promise<void> {
  try {
    const settings = await balancesApi.updateSettings(
      entry.payload as { version: string; base_currency: string },
    )
    await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
      await db.balanceSettings.put(serverSettingsToLocal(settings))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      const fresh = await balancesApi.getSettings()
      const local = await db.balanceSettings.get(SETTINGS_KEY)
      const base = local?.baseCurrency ?? fresh.baseCurrency
      const settings = await balancesApi.updateSettings({
        version: fresh.version,
        base_currency: base,
      })
      await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
        await db.balanceSettings.put(serverSettingsToLocal(settings))
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

// --- Pull ----------------------------------------------------------------------------

export async function pullAll(): Promise<void> {
  if (pulling) return
  pulling = true
  try {
    await Promise.all([
      pullNodes(),
      pullSettings(),
      pullRates(),
      pullCategories(),
      pullGoalsAll(),
      pullSpendingAll(),
    ])
  } catch {
    // Pull is best-effort; a failed pull just retries on the next trigger.
  } finally {
    pulling = false
  }
}

async function pullNodes(): Promise<void> {
  const server = await balancesApi.listNodes()
  const serverIds = new Set(server.map((n) => n.id))
  await db.transaction('rw', db.balanceNodes, async () => {
    for (const n of server) {
      const local = await db.balanceNodes.get(n.id)
      // Local edits win until they've been pushed.
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.balanceNodes.put(serverNodeToLocal(n))
      }
    }
    const locals = await db.balanceNodes.toArray()
    for (const l of locals) {
      if (l.dirty === 0 && !serverIds.has(l.id)) {
        await db.balanceNodes.delete(l.id)
      }
    }
  })
}

async function pullSettings(): Promise<void> {
  const settings = await balancesApi.getSettings()
  const local = await db.balanceSettings.get(SETTINGS_KEY)
  if (!local || local.dirty === 0) {
    await db.balanceSettings.put(serverSettingsToLocal(settings))
  }
}

async function pullRates(): Promise<void> {
  const rates = await balancesApi.listRates()
  const currencies = new Set(rates.map((r) => r.currency))
  await db.transaction('rw', db.exchangeRates, async () => {
    for (const r of rates) {
      const local = await db.exchangeRates.get(r.currency)
      // A local edit (dirty) wins until it's been pushed.
      if (!local || local.dirty === 0) {
        await db.exchangeRates.put({
          currency: r.currency,
          rate: r.rate,
          version: r.version,
          updatedAt: r.updatedAt,
          dirty: 0,
        })
      }
    }
    for (const l of await db.exchangeRates.toArray()) {
      if (l.dirty === 0 && !currencies.has(l.currency)) {
        await db.exchangeRates.delete(l.currency)
      }
    }
  })
}

// --- Lifecycle -----------------------------------------------------------------------

/** Start the sync loops for every synced entity. Returns a cleanup function. */
export function startSync(): () => void {
  void pullAll().then(() => {
    void (async () => {
      if ((await db.outbox.count()) > 0) schedulePush()
    })()
  })

  const onOnline = () => {
    void pullAll()
    schedulePush()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void pullAll()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  const safety = setInterval(() => {
    void (async () => {
      if ((await db.outbox.count()) > 0) schedulePush()
    })()
  }, SAFETY_FLUSH_MS)
  const pull = setInterval(() => void pullAll(), PULL_INTERVAL_MS)

  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(safety)
    clearInterval(pull)
    if (pushTimer) clearTimeout(pushTimer)
  }
}
