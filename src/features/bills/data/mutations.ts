/**
 * Local-first writes of bills: the Dexie row and its outbox entry in one transaction, then a
 * push. The PATCH is a full representation, so an update always sends the whole row.
 */
import { db } from '#/db/db'
import { enqueueCreate, enqueueDelete, enqueueUpsert } from '#/db/enqueue'
import { schedulePush } from '#/db/sync'
import type { LocalBill } from '#/db/types'
import type {
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import { billOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { dropSetAsidesOf } from '#/features/setAsides/data/mutations'
import { unlinkLedgerFrom } from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { newId } from '#/lib/uuid'
import { localBillToCreateWire, localBillToUpdateWire } from './mappers'

export type BillDraft = {
  name: string
  amount: number
  currency: CurrencyCode
  /** Null = "Just once". */
  frequency: ObligationFrequency | null
  /** Read only when `frequency` is 'custom'. */
  customInterval?: number | null
  customUnit?: IntervalUnit | null
  nextDue: string
  /** Read only for a repeating bill. */
  endsOn?: string | null
  walletId: string | null
  saveWalletId?: string | null
  categoryId: string
  merchantId?: string | null
  note?: string | null
  autopay?: boolean
  /** Defaults to true ("Must pay"). */
  mustPay?: boolean
  color: string
  setAsideDay?: number | null
}

/** Any field of a bill the client may change, including what the planner writes. */
export type BillPatch = Partial<BillDraft> &
  Partial<
    Pick<
      LocalBill,
      'position' | 'plannedAt' | 'planAmount' | 'planCount' | 'planStart'
    >
  >

const now = () => new Date().toISOString()

/** The repeat fields as the server keeps them: an interval only with 'custom', an end only when repeating. */
function shaped(bill: LocalBill): LocalBill {
  const custom = bill.frequency === 'custom'
  return {
    ...bill,
    customInterval: custom ? bill.customInterval : null,
    customUnit: custom ? bill.customUnit : null,
    endsOn: bill.frequency ? bill.endsOn : null,
  }
}

async function nextPosition(): Promise<number> {
  return (
    (await db.bills.toArray())
      .filter((b) => b.deleted === 0)
      .reduce((max, b) => Math.max(max, b.position), -1) + 1
  )
}

async function persist(bill: LocalBill): Promise<void> {
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await db.bills.put(bill)
    await enqueueUpsert(
      'bill',
      bill.id,
      bill.version,
      localBillToCreateWire(bill),
      localBillToUpdateWire(bill),
    )
  })
  schedulePush()
}

export async function createBill(draft: BillDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const bill = shaped({
    id,
    name: draft.name,
    amount: draft.amount,
    currency: draft.currency,
    frequency: draft.frequency,
    customInterval: draft.customInterval ?? null,
    customUnit: draft.customUnit ?? null,
    nextDue: draft.nextDue,
    endsOn: draft.endsOn ?? null,
    walletId: draft.walletId,
    saveWalletId: draft.saveWalletId ?? null,
    categoryId: draft.categoryId,
    merchantId: draft.merchantId ?? null,
    note: draft.note ?? null,
    autopay: draft.autopay ?? false,
    mustPay: draft.mustPay ?? true,
    color: draft.color,
    position: await nextPosition(),
    closedAt: null,
    plannedAt: null,
    planAmount: null,
    planCount: null,
    planStart: null,
    setAsideDay: draft.setAsideDay ?? null,
    createdAt: ts,
    updatedAt: ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  })
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await db.bills.put(bill)
    await enqueueCreate('bill', id, localBillToCreateWire(bill))
  })
  schedulePush()
  return id
}

const PLAN_FIELDS = [
  'amount',
  'currency',
  'frequency',
  'customInterval',
  'customUnit',
  'nextDue',
  'endsOn',
  'mustPay',
  'walletId',
  'saveWalletId',
] as const satisfies ReadonlyArray<keyof LocalBill>

/** Name / colour / position edits leave the stored plan alone; these rewrite it. */
export const changesBillPlan = (before: LocalBill, after: LocalBill): boolean =>
  PLAN_FIELDS.some((field) => before[field] !== after[field])

async function patched(
  id: string,
  patch: Partial<LocalBill>,
): Promise<{ before: LocalBill; after: LocalBill } | null> {
  const existing = await db.bills.get(id)
  if (!existing || existing.deleted !== 0) return null
  const defined = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    ),
  ) as Partial<LocalBill>
  const after = shaped({ ...existing, ...defined, updatedAt: now(), dirty: 1 })
  await persist(after)
  return { before: existing, after }
}

/** Change any of a bill's fields; the rest keep their stored values. */
export async function updateBill(id: string, patch: BillPatch): Promise<void> {
  const change = await patched(id, patch)
  if (change && changesBillPlan(change.before, change.after))
    requestPlanRecalc(billOwner(id))
}

/** Move `nextDue` on as occurrences settle — bookkeeping, not a change of plan. */
export async function setBillNextDue(
  id: string,
  nextDue: string,
): Promise<void> {
  await patched(id, { nextDue })
}

/** Record the plan the planner just wrote for this bill (no-op for a vanished bill). */
export async function setBillPlanSnapshot(
  id: string,
  snapshot: Pick<
    LocalBill,
    'plannedAt' | 'planAmount' | 'planCount' | 'planStart'
  >,
): Promise<void> {
  await patched(id, snapshot)
}

/**
 * Delete a bill. Mirrors the server: its set-asides go with it, and its payments keep their
 * rows with the link cleared. Its planned rows are left to the planner, which resolves rows
 * whose origin is gone.
 */
export async function deleteBill(id: string): Promise<void> {
  await db.transaction('rw', db.bills, db.outbox, async () => {
    await enqueueDelete('bill', id)
    await db.bills.delete(id)
  })
  await dropSetAsidesOf('billId', id)
  await unlinkLedgerFrom('billId', id)
  schedulePush()
}
