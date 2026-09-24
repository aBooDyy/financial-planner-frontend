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
import {
  pullCategories,
  pushCategoryEntry,
} from '#/features/categories/data/sync'
import { pullGoalsAll, pushGoalsEntry } from '#/features/goals/data/sync'
import {
  pullImportTemplates,
  pushImportTemplatesEntry,
} from '#/features/import/data/sync'
import { pullInboundImportsDelta } from '#/features/inbound-imports/data/sync'
import {
  pullMerchantsAll,
  pushMerchantsEntry,
} from '#/features/merchants/data/sync'
import {
  pullCustomCurrencies,
  pushSettingsEntry,
} from '#/features/settings/data/sync'
import {
  pullSpendingAll,
  pushSpendingEntry,
  pushTransactionCreates,
  pushTransactionDeletes,
} from '#/features/transactions/data/sync'
import { pushTransferEntry } from '#/features/transactions/data/transferSync'
import {
  pullPlannedDelta,
  pushPlannedCreates,
  pushPlannedEntry,
} from '#/features/planned/data/sync'
import { configLimits } from '#/lib/config/appConfig'
import { ApiError } from '#/lib/apiError'
import { db } from './db'
import { notePlannerInputsPulled } from './pullState'
import { SETTINGS_KEY } from './types'
import type { OutboxEntity, OutboxEntry, OutboxOp } from './types'

const PUSH_DEBOUNCE_MS = 800
const SAFETY_FLUSH_MS = 30_000
const PULL_INTERVAL_MS = 300_000

/**
 * The floor between two pulls triggered by a tab regaining focus. Returning to the app is
 * a hint that data may have moved, not a reason to refetch every collection each time it
 * happens — without this, alt-tabbing twice costs two full fan-outs.
 */
const VISIBILITY_PULL_MIN_MS = 60_000

/**
 * `transaction` creates go out as `POST /transactions/bulk` and `transaction` deletes as
 * `POST /transactions/bulk-delete`. A CSV import queues one create per row and undoing it
 * queues one delete per row, and a queue drained a round trip at a time turns a
 * three-second commit into minutes of syncing — a measured 2 608-row undo spent ~75 s in
 * continuous HTTP. `planned` creates go out as `POST /planned-transactions/bulk` for the same
 * reason: the planner's first pass over an account writes dozens at once.
 *
 * Only these are batched, and only within one entity and op. Neither kind references another
 * row of its own run — ledger rows point at wallets, categories and merchants queued *before*
 * them, planned rows at goals, streams and schedules — so a batch cannot race its own
 * prerequisite, which a batch of `node` creates (child before parent) could. Splitting the
 * run at every change of op is what keeps a create and the delete that follows it on the same
 * row in their queued order. How many rows one batch carries is the server's own cap.
 */
type BulkKind = {
  entity: OutboxEntity
  op: OutboxOp
  batchSize: () => number
  push: (batch: ReadonlyArray<OutboxEntry>) => Promise<void>
}

const BULK_KINDS: ReadonlyArray<BulkKind> = [
  {
    entity: 'transaction',
    op: 'create',
    batchSize: () => configLimits().transactionBulkMax,
    push: (batch) => pushTransactionCreates(batch),
  },
  {
    entity: 'transaction',
    op: 'delete',
    batchSize: () => configLimits().transactionBulkMax,
    push: (batch) => pushTransactionDeletes(batch),
  },
  {
    entity: 'planned',
    op: 'create',
    batchSize: () => configLimits().plannedBulkMax,
    push: (batch) => pushPlannedCreates(batch),
  },
]

const bulkKindOf = (entry: OutboxEntry): BulkKind | undefined =>
  BULK_KINDS.find((k) => k.entity === entry.entity && k.op === entry.op)

/**
 * How many batches are in flight at once. Batching alone left the client waiting out a
 * whole server-side insert before starting the next, which independent batches never need
 * to do. Measured against the real database, 4 000 rows: one batch at a time 2 377 ms,
 * **4 in flight 1 733 ms**, 8 in flight 1 931 ms — past four, the batches contend for the
 * connection pool and the event loop and give the gain back.
 */
const BULK_CONCURRENCY = 4

/** Entries read per queue query: one full wave, so a page is never the real cap. */
const pushPageSize = (): number =>
  configLimits().transactionBulkMax * BULK_CONCURRENCY

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pushing = false
let pushQueued = false
let pulling = false
let lastPullAt = 0
let stopRunningSync: (() => void) | null = null

const isNetworkError = (e: unknown): boolean =>
  e instanceof ApiError && e.status === 0
const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Push ----------------------------------------------------------------------------

/** Queue a debounced outbox flush after a local write. */
export function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void flushOutbox()
  }, PUSH_DEBOUNCE_MS)
}

/** Drain the outbox now and resolve when it stops. Single-flight, like the timer path. */
export async function flushOutbox(): Promise<void> {
  if (pushing) {
    pushQueued = true
    return
  }
  pushing = true
  try {
    // Drain in insertion order; stop on the first network failure to retry later.
    for (;;) {
      const page = await db.outbox
        .orderBy('seq')
        .limit(pushPageSize())
        .toArray()
      if (page.length === 0) break
      if (!(await pushPage(page))) break
    }
  } finally {
    pushing = false
    if (pushQueued) {
      pushQueued = false
      schedulePush()
    }
  }
}

/**
 * How many entries from `at` are independent same-op entries that may go out together. The
 * run is not capped by what one request carries — `pushRun` cuts it into batches — only by
 * the page. Everything else is a run of one, so ordering between entities, and between the
 * ops on one row, is exactly what it was.
 */
export function bulkRunLength(
  page: ReadonlyArray<OutboxEntry>,
  at: number,
): number {
  const kind = bulkKindOf(page[at])
  if (!kind) return 1
  let run = 1
  while (at + run < page.length && bulkKindOf(page[at + run]) === kind) {
    run += 1
  }
  return run
}

/** Returns true if the whole page was handled, false to stop draining (network). */
async function pushPage(page: ReadonlyArray<OutboxEntry>): Promise<boolean> {
  let at = 0
  while (at < page.length) {
    const run = bulkRunLength(page, at)
    if (!(await pushRun(page.slice(at, at + run)))) return false
    at += run
  }
  return true
}

/**
 * A stretch of independent same-op entries, or one entry of anything else. The stretch is
 * cut into request-sized batches and sent a wave at a time. Each push removes its own
 * entries, so a wave that half-succeeds leaves the rest queued — every entry in it is
 * independently valid, which is the same reason they may be sent together at all.
 */
async function pushRun(run: ReadonlyArray<OutboxEntry>): Promise<boolean> {
  const kind = bulkKindOf(run[0])
  if (run.length === 1 || !kind) return pushEntry(run[0])
  const batches = chunked(run, kind.batchSize())
  for (let at = 0; at < batches.length; at += BULK_CONCURRENCY) {
    const wave = batches.slice(at, at + BULK_CONCURRENCY)
    const handled = await Promise.all(
      wave.map((batch) => pushBatch(batch, kind)),
    )
    if (handled.includes(false)) return false
  }
  return true
}

const chunked = <T>(items: ReadonlyArray<T>, size: number): T[][] => {
  const out: T[][] = []
  for (let at = 0; at < items.length; at += size) {
    out.push(items.slice(at, at + size))
  }
  return out
}

/** Returns true if the batch was handled, false to stop draining (network). */
async function pushBatch(
  batch: ReadonlyArray<OutboxEntry>,
  kind: BulkKind,
): Promise<boolean> {
  try {
    await kind.push(batch)
    return true
  } catch (e) {
    if (isNetworkError(e)) return false
    // The batch failed as a whole, so no entry got a verdict of its own. Retrying singly
    // isolates the one row the server refused instead of discarding the other 999.
    for (const entry of batch) {
      if (!(await pushEntry(entry))) return false
    }
    return true
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
    } else if (entry.entity === 'transfer') {
      await pushTransferEntry(entry)
    } else if (entry.entity === 'category') {
      await pushCategoryEntry(entry)
    } else if (entry.entity === 'customCurrency' || entry.entity === 'rate') {
      await pushSettingsEntry(entry)
    } else if (
      entry.entity === 'merchant' ||
      entry.entity === 'merchantAlias'
    ) {
      await pushMerchantsEntry(entry)
    } else if (entry.entity === 'importTemplate') {
      await pushImportTemplatesEntry(entry)
    } else if (entry.entity === 'planned') {
      await pushPlannedEntry(entry)
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
      pullCustomCurrencies(),
      pullMerchantsAll(),
      pullImportTemplates(),
      // Everything the planner generates from, so it only ever runs over the server's rows.
      Promise.all([pullGoalsAll(), pullSpendingAll(), pullPlannedDelta()]).then(
        notePlannerInputsPulled,
      ),
      pullInboundImportsDelta(),
    ])
  } catch {
    // Pull is best-effort; a failed pull just retries on the next trigger.
  } finally {
    pulling = false
    lastPullAt = Date.now()
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

/**
 * Start the sync loops for every synced entity. Returns a cleanup function.
 *
 * Sync spans the whole app, not a page: one pull fans out to every collection, so binding
 * it to a page would refetch the entire dataset on each navigation. Mount it once, from the
 * root, for as long as there is a session. The guard below keeps a second caller from
 * starting a rival set of loops if one is ever added back.
 */
export function startSync(): () => void {
  if (stopRunningSync) return () => {}

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
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastPullAt < VISIBILITY_PULL_MIN_MS) return
    void pullAll()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  const safety = setInterval(() => {
    void (async () => {
      if ((await db.outbox.count()) > 0) schedulePush()
    })()
  }, SAFETY_FLUSH_MS)
  const pull = setInterval(() => void pullAll(), PULL_INTERVAL_MS)

  const stop = () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(safety)
    clearInterval(pull)
    if (pushTimer) clearTimeout(pushTimer)
    // A cleared handle is not a pending push; leaving it non-null would break the
    // "pushTimer !== null ⇔ a flush is queued" reading every other line here relies on.
    pushTimer = null
    stopRunningSync = null
  }
  stopRunningSync = stop
  return stop
}
