import { walletsApi } from '#/features/wallets/api/walletsApi'
import type {
  CreateNodeWire,
  UpdateNodeWire,
  UpdateSettingsWire,
} from '#/features/wallets/api/types'
import {
  localNodeToUpdateWire,
  localSettingsToUpdateWire,
  serverNodeToLocal,
  serverSettingsToLocal,
} from '#/features/wallets/data/mappers'
import {
  pullCategories,
  pushCategoryEntry,
} from '#/features/categories/data/sync'
import { pullBills, pushBillsEntry } from '#/features/bills/data/sync'
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
import {
  pushTransferCreates,
  pushTransferDeletes,
  pushTransferEntry,
} from '#/features/transactions/data/transferSync'
import {
  pullSetAsides,
  pushSetAsidesEntry,
} from '#/features/setAsides/data/sync'
import {
  pullPlannedDelta,
  pushPlannedCreates,
  pushPlannedEntry,
} from '#/features/planned/data/sync'
import { configLimits } from '#/lib/config/appConfig'
import { ApiError } from '#/lib/apiError'
import { db } from './db'
import { scheduleLedgerTotalsCheck } from './ledgerTotalsCheck'
import { recordPlannerInputsPulled } from './plannerInputs'
import { trackSync } from './syncActivity'
import {
  failureOf,
  flagEntry,
  isBackingOff,
  releaseRejected,
  rowKey,
} from './syncFailure'
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
 * continuous HTTP. `transfer` creates and deletes ride `POST /transfers/bulk` and
 * `POST /transfers/bulk-delete` for the same reason — an import can hold hundreds — and
 * `planned` creates go out as `POST /planned-transactions/bulk`: the planner's first pass over
 * an account writes dozens at once.
 *
 * Only these are batched, and only within one entity and op. No kind references another
 * row of its own run — ledger rows and transfers point at wallets, categories and merchants
 * queued *before* them, planned rows at goals, streams and bills — so a batch cannot race
 * its own prerequisite, which a batch of `node` creates (child before parent) could. Splitting the
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
    entity: 'transfer',
    op: 'create',
    batchSize: () => configLimits().transactionBulkMax,
    push: (batch) => pushTransferCreates(batch),
  },
  {
    entity: 'transfer',
    op: 'delete',
    batchSize: () => configLimits().transactionBulkMax,
    push: (batch) => pushTransferDeletes(batch),
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

/**
 * Drain the outbox now and resolve when it stops. Single-flight, like the timer path.
 *
 * A pass that settles an entry which had failed before goes round again: a row refused because
 * something it points at had not reached the server yet may go through now.
 */
export async function flushOutbox(): Promise<void> {
  // Offline the push can only fail, flagging the head entry "couldn't reach the server" for
  // a state that is expected; the entries wait as plain pending ones and go on reconnect.
  if (navigator.onLine === false) return
  if (pushing) {
    pushQueued = true
    return
  }
  pushing = true
  try {
    await trackSync(async () => {
      while ((await drainPass()) === 'released') {
        // The released entries are retried by the next pass.
      }
    })
  } finally {
    pushing = false
    if (pushQueued) {
      pushQueued = false
      schedulePush()
    }
  }
}

/**
 * One drain's bookkeeping. `blocked` holds every row whose entry failed, is backing off or is
 * still queued after its push: a row's later entries never overtake its earlier ones.
 */
type Pass = { now: number; blocked: Set<string>; released: boolean }

type PassOutcome = 'done' | 'stopped' | 'released'

/** One walk over the queue in `seq` order. It stops at the first unavailable failure. */
async function drainPass(): Promise<PassOutcome> {
  const pass: Pass = { now: Date.now(), blocked: new Set(), released: false }
  let after = 0
  for (;;) {
    const page = await db.outbox
      .where('seq')
      .above(after)
      .limit(pushPageSize())
      .toArray()
    if (page.length === 0) break
    after = page[page.length - 1].seq ?? after
    if (!(await pushPage(page, pass))) return 'stopped'
  }
  if (pass.released && (await releaseRejected()) > 0) return 'released'
  return 'done'
}

/** The rows an entry writes: its own, and any others a batch action touches. */
const rowKeysOf = (entry: OutboxEntry): string[] => [
  rowKey(entry.entity, entry.id),
  ...(entry.alsoRows ?? []).map((id) => rowKey(entry.entity, id)),
]

const block = (entry: OutboxEntry, pass: Pass): void => {
  for (const key of rowKeysOf(entry)) pass.blocked.add(key)
}

const isHeld = (entry: OutboxEntry, pass: Pass): boolean =>
  rowKeysOf(entry).some((key) => pass.blocked.has(key)) ||
  isBackingOff(entry, pass.now)

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

/** A bulk run cut short at the first entry this pass holds back. */
function sendableRunLength(
  page: ReadonlyArray<OutboxEntry>,
  at: number,
  pass: Pass,
): number {
  const run = bulkRunLength(page, at)
  for (let i = 1; i < run; i++) {
    if (isHeld(page[at + i], pass)) return i
  }
  return run
}

/** Returns true if the whole page was walked, false to stop draining. */
async function pushPage(
  page: ReadonlyArray<OutboxEntry>,
  pass: Pass,
): Promise<boolean> {
  let at = 0
  while (at < page.length) {
    if (isHeld(page[at], pass)) {
      block(page[at], pass)
      at += 1
      continue
    }
    const run = page.slice(at, at + sendableRunLength(page, at, pass))
    const walked = await pushRun(run)
    await noteOutcomes(run, pass)
    if (!walked) return false
    at += run.length
  }
  return true
}

/**
 * After a push: an entry still queued blocks its row for the rest of the pass, and an entry
 * that had failed before and is now gone means its dependants may succeed.
 */
async function noteOutcomes(
  run: ReadonlyArray<OutboxEntry>,
  pass: Pass,
): Promise<void> {
  const seqs = run.map((entry) => entry.seq).filter((seq) => seq !== undefined)
  const left = await db.outbox.bulkGet(seqs)
  const stillQueued = new Set(left.map((entry) => entry?.seq))
  for (const entry of run) {
    if (stillQueued.has(entry.seq)) {
      block(entry, pass)
    } else if (entry.failure) {
      pass.released = true
    }
  }
}

/**
 * A stretch of independent same-op entries, or one entry of anything else. The stretch is
 * cut into request-sized batches and sent a wave at a time. Each push settles its own
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

/** Returns true to keep draining, false to stop (the server is unavailable). */
async function pushBatch(
  batch: ReadonlyArray<OutboxEntry>,
  kind: BulkKind,
): Promise<boolean> {
  try {
    await kind.push(batch)
    return true
  } catch (e) {
    const failure = failureOf(e)
    if (!failure) return false
    if (failure.kind === 'unavailable') {
      // Only the head is marked: the rest were never judged, so they are plainly pending.
      await flagEntry(batch[0], failure)
      return false
    }
    // Refused as a whole, so no entry got a verdict of its own. Retrying singly isolates the
    // one row the server refuses instead of flagging the other 999.
    for (const entry of batch) {
      if (!(await pushEntry(entry))) return false
    }
    return true
  }
}

/**
 * Push one entry. A handler settles success and the 404/409 cases it owns; anything it throws
 * is flagged on the entry, which stays queued. Returns false to stop draining: the server is
 * unavailable (or the session is ending), so every later entry would fail the same way.
 */
async function pushEntry(entry: OutboxEntry): Promise<boolean> {
  try {
    await dispatch(entry)
    return true
  } catch (e) {
    const failure = failureOf(e)
    if (!failure) return false
    await flagEntry(entry, failure)
    return failure.kind === 'rejected'
  }
}

async function dispatch(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'settings') return pushSettings(entry)
  if (entry.entity === 'income' || entry.entity === 'goal') {
    return pushGoalsEntry(entry)
  }
  if (entry.entity === 'bill') return pushBillsEntry(entry)
  if (entry.entity === 'setAside') return pushSetAsidesEntry(entry)
  if (entry.entity === 'transaction' || entry.entity === 'budget') {
    return pushSpendingEntry(entry)
  }
  if (entry.entity === 'transfer') return pushTransferEntry(entry)
  if (entry.entity === 'category') return pushCategoryEntry(entry)
  if (entry.entity === 'customCurrency' || entry.entity === 'rate') {
    return pushSettingsEntry(entry)
  }
  if (entry.entity === 'merchant' || entry.entity === 'merchantAlias') {
    return pushMerchantsEntry(entry)
  }
  if (entry.entity === 'importTemplate') return pushImportTemplatesEntry(entry)
  if (entry.entity === 'planned') return pushPlannedEntry(entry)
  if (entry.op === 'create') return pushNodeCreate(entry)
  if (entry.op === 'update') return pushNodeUpdate(entry)
  return pushNodeDelete(entry)
}

async function pushNodeCreate(entry: OutboxEntry): Promise<void> {
  try {
    const node = await walletsApi.createNode(entry.payload as CreateNodeWire)
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
    const node = await walletsApi.updateNode(
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
  const fresh = (await walletsApi.listNodes()).find((n) => n.id === entry.id)
  const local = await db.balanceNodes.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  const rebased = { ...local, version: fresh.version }
  try {
    const node = await walletsApi.updateNode(
      entry.id,
      localNodeToUpdateWire(rebased),
    )
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(node))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    // Still conflicting — accept the server copy and drop the op rather than loop.
    await db.transaction('rw', db.balanceNodes, db.outbox, async () => {
      await db.balanceNodes.put(serverNodeToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushNodeDelete(entry: OutboxEntry): Promise<void> {
  try {
    await walletsApi.deleteNode(entry.id)
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
    const settings = await walletsApi.updateSettings(
      entry.payload as UpdateSettingsWire,
    )
    await db.transaction('rw', db.balanceSettings, db.outbox, async () => {
      await db.balanceSettings.put(serverSettingsToLocal(settings))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      // The PATCH is a full representation, so the rebase re-sends the whole local row.
      const fresh = await walletsApi.getSettings()
      const local = await db.balanceSettings.get(SETTINGS_KEY)
      const settings = await walletsApi.updateSettings(
        local
          ? localSettingsToUpdateWire({ ...local, version: fresh.version })
          : (entry.payload as UpdateSettingsWire),
      )
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
  if (navigator.onLine === false) return
  if (pulling) return
  pulling = true
  try {
    await trackSync(() =>
      Promise.all([
        pullNodes(),
        pullSettings(),
        pullRates(),
        pullCategories(),
        pullCustomCurrencies(),
        pullMerchantsAll(),
        pullImportTemplates(),
        // Everything the planner generates from, so it only ever runs over the server's rows.
        Promise.all([
          pullGoalsAll(),
          pullBills(),
          pullSetAsides(),
          pullSpendingAll(),
          pullPlannedDelta(),
        ]).then(recordPlannerInputsPulled),
        pullInboundImportsDelta(),
      ]),
    )
  } catch {
    // Pull is best-effort; a failed pull just retries on the next trigger.
  } finally {
    pulling = false
    lastPullAt = Date.now()
  }
}

async function pullNodes(): Promise<void> {
  const server = await walletsApi.listNodes()
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

export async function pullSettings(): Promise<void> {
  const settings = await walletsApi.getSettings()
  const local = await db.balanceSettings.get(SETTINGS_KEY)
  if (!local || local.dirty === 0) {
    await db.balanceSettings.put(serverSettingsToLocal(settings))
  }
}

async function pullRates(): Promise<void> {
  const rates = await walletsApi.listRates()
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
    scheduleLedgerTotalsCheck()
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
