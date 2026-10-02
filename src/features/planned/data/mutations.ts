/**
 * What the user does to a planned item: confirm it (fully or in part), close the rest, skip
 * it, move it, change its amount — and add a contribution to a goal, now or for later. All
 * local-first: Dexie writes plus outbox entries, working offline.
 *
 * Confirming writes the real thing, linked back by `plannedId`: an ordinary transaction for
 * income and payments, a dated set-aside for a set-aside. The item's status follows from
 * what settles it (`rows.ts#closeCovered`), so a partial leaves it open with a remainder.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalBill, LocalPlanned } from '#/db/types'
import { setBillNextDue } from '#/features/bills/data/mutations'
import { buildCatalog } from '#/features/categories/data/catalog'
import { occurrenceNeeds, spill } from '#/features/planning/data/fill'
import type {
  OccurrenceChunk,
  OccurrenceNeed,
} from '#/features/planning/data/fill'
import {
  billOccurrences,
  firstOpenOccurrence,
  isSettledOccurrence,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import { moveSetAsides } from '#/features/setAsides/data/batches'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { createSetAside } from '#/features/setAsides/data/mutations'
import { releaseForPayment } from '#/features/setAsides/data/payment'
import type { PlannedRole } from '#/features/planned/api/types'
import { addTransactionWithId } from '#/features/transactions/data/mutations'
import type { TxType } from '#/features/transactions/api/types'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { addMonthsISO, isoOf } from './dates'
import {
  closeCovered,
  currentRates,
  insertPlanned,
  removePlanned,
  savePlanned,
  settlementsOf,
} from './rows'
import { dueList, indexSettlements, settledOf } from './settle'
import { newId } from '#/lib/uuid'
import { PLANNED_NAMESPACE, uuidv5 } from './ids'

export type PlannedActionCode =
  | 'not_found'
  | 'not_open'
  | 'no_wallet'
  | 'bad_amount'
  | 'has_settlements'
  | 'not_manual'
  | 'origin_gone'
  | 'category_invalid'

/** A planned action the item's state does not allow. `code` is stable; show your own copy. */
export class PlannedActionError extends Error {
  readonly code: PlannedActionCode
  constructor(code: PlannedActionCode) {
    super(`planned.${code}`)
    this.code = code
  }
}

const today = (): string => isoOf(new Date())

async function openItem(id: string): Promise<LocalPlanned> {
  const item = await db.plannedTransactions.get(id)
  if (!item || item.deleted !== 0) throw new PlannedActionError('not_found')
  if (item.status !== 'open') throw new PlannedActionError('not_open')
  return item
}

async function settledNow(item: LocalPlanned): Promise<number> {
  const { txns, setAsides } = await settlementsOf([item.id])
  return settledOf(
    item,
    indexSettlements(txns, setAsides),
    await currentRates(),
  )
}

/** The bill a row belongs to, while it still exists. */
async function billOf(item: LocalPlanned): Promise<LocalBill | null> {
  if (!item.billId) return null
  const bill = await db.bills.get(item.billId)
  return bill && bill.deleted === 0 ? bill : null
}

const billPayments = async (bill: LocalBill) =>
  paymentRowsOf(
    bill.id,
    await db.plannedTransactions.where('billId').equals(bill.id).toArray(),
  )

/**
 * Keep a bill's `nextDue` on its first occurrence not yet dealt with: paying, closing or
 * skipping that one moves it on past every settled one after it; settling a later occurrence
 * (paying ahead) leaves it where it is.
 */
export async function syncBillNextDue(billId: string): Promise<void> {
  const bill = await db.bills.get(billId)
  if (!bill || bill.deleted !== 0) return
  const next = firstOpenOccurrence(bill, await billPayments(bill))
  if (next !== bill.nextDue) await setBillNextDue(bill.id, next)
}

const isBillPayment = (
  item: LocalPlanned,
): item is LocalPlanned & { billId: string } =>
  item.origin === 'bill' && item.role === 'payment' && item.billId !== null

const syncNextDueOf = async (item: LocalPlanned): Promise<void> => {
  if (isBillPayment(item)) await syncBillNextDue(item.billId)
}

/**
 * A bill occurrence that won't be paid (skipped, or closed with the rest abandoned) keeps its
 * money with the bill: what is still set aside for it rolls to the next open occurrence. A
 * one-off has none — closing the bill frees it.
 */
async function rollToNextOccurrence(item: LocalPlanned): Promise<void> {
  if (item.origin !== 'bill' || item.role !== 'payment') return
  const bill = await billOf(item)
  if (!bill) return
  const held = (
    await db.setAsides.where('billId').equals(bill.id).toArray()
  ).filter((a) => isLiveSetAside(a) && a.occurrence === item.occurrence)
  if (held.length === 0) return
  const payments = await billPayments(bill)
  const next = billOccurrences(bill, addMonthsISO(item.occurrence, 24)).find(
    (o) => o > item.occurrence && !isSettledOccurrence(payments, o),
  )
  if (!next) return
  await moveSetAsides(
    held.map((a) => ({
      id: a.id,
      to: { owner: { billId: bill.id, occurrence: next } },
    })),
    { date: today() },
  )
}

/** A bill's open occurrences and what each still needs, as stored right now. */
export async function readBillNeeds(
  bill: LocalBill,
  rates: RatesMap,
): Promise<OccurrenceNeed[]> {
  const [payments, setAsides, txns] = await Promise.all([
    billPayments(bill),
    db.setAsides.where('billId').equals(bill.id).toArray(),
    db.transactions.where('billId').equals(bill.id).toArray(),
  ])
  const index = indexSettlements(
    txns.filter((t) => t.deleted === 0),
    setAsides.filter((a) => a.deleted === 0),
  )
  return occurrenceNeeds(bill, payments, setAsides, index, rates)
}

/**
 * Money set aside for a bill, filled into its open occurrences in order — those due on or
 * after `from`.
 */
async function chunksFor(
  bill: LocalBill,
  amount: number,
  rates: RatesMap,
  from: string,
): Promise<OccurrenceChunk[]> {
  const needs = await readBillNeeds(bill, rates)
  return spill(
    needs.filter((n) => n.occurrence >= from),
    amount,
  )
}

type SetAsideTarget =
  | { kind: 'goal'; goalId: string }
  | { kind: 'bill'; bill: LocalBill }

/** Who a set-aside row puts money aside for: its goal, or its bill. */
async function setAsideTargetOf(
  item: LocalPlanned,
): Promise<SetAsideTarget | null> {
  if (item.goalId) {
    const goal = await db.goals.get(item.goalId)
    return goal && goal.deleted === 0 ? { kind: 'goal', goalId: goal.id } : null
  }
  const bill = await billOf(item)
  return bill ? { kind: 'bill', bill } : null
}

/** A category the user's tree actually has for this type, preferring `wanted`. */
async function categoryFor(
  type: TxType,
  wanted: string | null | undefined,
): Promise<string> {
  const catalog = buildCatalog(await db.categories.toArray())
  if (wanted && catalog.has(wanted)) {
    if (catalog.rootOf(wanted).type === type) return wanted
  }
  // A confirmed payday belongs under Salary, not the catch-all income root.
  const salary = type === 'income' ? catalog.bySlug('salary') : null
  if (salary?.type === 'income') return salary.id
  const fallback = catalog.fallbackFor(type)
  if (fallback) return fallback.id
  // Nothing pulled yet to check against: trust what the row already names.
  if (wanted && catalog.all.length === 0) return wanted
  throw new PlannedActionError('category_invalid')
}

/** A live wallet's currency; null for a group, a deleted or an unknown node. */
export async function walletCurrency(
  walletId: string,
): Promise<CurrencyCode | null> {
  const node = await db.balanceNodes.get(walletId)
  return node && node.deleted === 0 && node.kind === 'wallet'
    ? (node.currency ?? null)
    : null
}

export type ConfirmInput = {
  /** In the item's currency. Defaults to what is still open on it. */
  amount?: number
  /** Defaults to the item's suggested wallet. */
  walletId?: string | null
  /** Set-asides only: held outside any wallet ("Dad's help") instead of in one. */
  externalLabel?: string | null
  /** When it happened. Defaults to today, not the planned date. */
  date?: string
  /** Income and payments: the leaf category the transaction is filed under. */
  categoryId?: string | null
  /** Defaults to the bill's note, else the item's name. */
  note?: string | null
  /** Provenance marker for the transaction. */
  source?: string | null
  /** A caller-chosen id for what is written, so a retried confirm writes nothing twice. */
  settlementId?: string
}

export type ConfirmResult = {
  /** The first (usually only) row written. */
  settlementId: string
  /** Every row written: a bill set-aside spilling over occurrences writes one per occurrence. */
  settlementIds: string[]
  kind: 'transaction' | 'setAside'
  /** The item's status after the settlement landed. */
  status: LocalPlanned['status']
}

/**
 * Settle a planned item: write the transaction or set-aside it stands for, linked back to
 * it. Settling the whole remainder (or more — the excess still counts) closes it; less
 * leaves it open with a smaller remainder.
 */
export async function confirmPlanned(
  id: string,
  input: ConfirmInput = {},
): Promise<ConfirmResult> {
  const item = await openItem(id)
  // A set-aside is held for its goal or bill; with that gone there is nothing to hold it.
  const target = item.role === 'set_aside' ? await setAsideTargetOf(item) : null
  if (item.role === 'set_aside' && !target)
    throw new PlannedActionError('origin_gone')
  const rates = await currentRates()
  const remainder = Math.max(0, item.amount - (await settledNow(item)))
  const amount = input.amount ?? remainder
  if (!Number.isFinite(amount) || amount <= 0)
    throw new PlannedActionError('bad_amount')
  const date = input.date ?? today()
  const walletId = input.walletId !== undefined ? input.walletId : item.walletId
  const external = (target && input.externalLabel?.trim()) || null

  const settlementIds = target
    ? await writeSetAsides(item, target, {
        amount,
        walletId,
        external,
        date,
        note: input.note ?? null,
        id: input.settlementId,
        rates,
      })
    : [await writePayment(item, { ...input, amount, walletId, date }, rates)]

  const after = await db.plannedTransactions.get(item.id)
  await syncNextDueOf(item)
  schedulePush()
  return {
    settlementId: settlementIds[0],
    settlementIds,
    kind: target ? 'setAside' : 'transaction',
    status: after?.status ?? 'open',
  }
}

/**
 * The set-aside(s) a planned set-aside stands for. A goal's is one row; a bill's money fills
 * its open occurrences in order, one row per occurrence it reaches.
 */
async function writeSetAsides(
  item: LocalPlanned,
  target: SetAsideTarget,
  args: {
    amount: number
    walletId: string | null
    external: string | null
    date: string
    note: string | null
    id?: string
    rates: RatesMap
  },
): Promise<string[]> {
  const { external, rates } = args
  const currency = external
    ? item.currency
    : args.walletId
      ? await walletCurrency(args.walletId)
      : null
  if (!currency) throw new PlannedActionError('no_wallet')
  const where = {
    source: external ? ('outside' as const) : ('wallet' as const),
    walletId: external ? null : args.walletId,
    externalLabel: external,
    currency,
    note: args.note,
    date: args.date,
    plannedId: item.id,
  }
  if (target.kind === 'goal')
    return [
      await createSetAside(
        { goalId: target.goalId },
        {
          ...where,
          id: args.id,
          amount: convertMinor(args.amount, item.currency, currency, rates),
        },
      ),
    ]
  const { bill } = target
  const inBill = convertMinor(args.amount, item.currency, bill.currency, rates)
  // The payday it was planned for covers what falls due from then on.
  const chunks = await chunksFor(bill, inBill, rates, item.occurrence)
  const spread =
    chunks.length > 0 ? chunks : [{ occurrence: bill.nextDue, amount: inBill }]
  const ids: string[] = []
  for (const [i, chunk] of spread.entries()) {
    ids.push(
      await createSetAside(
        { billId: bill.id, occurrence: chunk.occurrence },
        {
          ...where,
          id:
            args.id && i > 0
              ? uuidv5(`${args.id}:${chunk.occurrence}`, PLANNED_NAMESPACE)
              : args.id,
          amount: convertMinor(chunk.amount, bill.currency, currency, rates),
        },
      ),
    )
  }
  return ids
}

/**
 * The transaction a planned payday or payment stands for. A payment releases what its bill
 * occurrence (or its goal) had set aside in the paying wallet.
 */
async function writePayment(
  item: LocalPlanned,
  input: ConfirmInput & {
    amount: number
    walletId: string | null
    date: string
  },
  rates: RatesMap,
): Promise<string> {
  const { walletId, date } = input
  const currency = walletId ? await walletCurrency(walletId) : null
  if (!walletId || !currency) throw new PlannedActionError('no_wallet')
  const inWallet = convertMinor(input.amount, item.currency, currency, rates)
  const type: TxType = item.role === 'income' ? 'income' : 'spend'
  const bill = await billOf(item)
  const wanted =
    input.categoryId !== undefined
      ? input.categoryId
      : (item.categoryId ?? bill?.categoryId ?? (await streamCategoryOf(item)))
  const goalId = type === 'spend' && !bill ? item.goalId : null
  const txId = input.settlementId ?? newId()
  await addTransactionWithId(txId, {
    type,
    amount: inWallet,
    currency,
    categoryId: await categoryFor(type, wanted),
    walletId,
    goalId,
    billId: type === 'spend' ? (bill?.id ?? null) : null,
    merchantId: bill?.merchantId ?? null,
    date,
    note: input.note !== undefined ? input.note : bill?.note || item.name,
    source: input.source ?? null,
    plannedId: item.id,
  })
  const paidFor = bill
    ? { billId: bill.id, occurrence: item.occurrence }
    : goalId
      ? { goalId }
      : null
  if (paidFor)
    await releaseForPayment(
      paidFor,
      { id: txId, walletId, amount: inWallet, currency, date },
      rates,
    )
  return txId
}

/** A payday files under its stream's own income category. */
async function streamCategoryOf(item: LocalPlanned): Promise<string | null> {
  if (!item.incomeStreamId) return null
  return (await db.incomeStreams.get(item.incomeStreamId))?.categoryId ?? null
}

/** Done, with whatever is still open abandoned — the goal is simply behind by that much. */
export async function closeRest(id: string): Promise<void> {
  const item = await openItem(id)
  await savePlanned({ ...item, status: 'done' })
  await rollToNextOccurrence(item)
  await syncNextDueOf(item)
  schedulePush()
}

/** Consciously not happening. Only while nothing settles it — otherwise close the rest. */
export async function skipPlanned(id: string): Promise<void> {
  const item = await openItem(id)
  if ((await settledNow(item)) > 0)
    throw new PlannedActionError('has_settlements')
  await savePlanned({ ...item, status: 'skipped' })
  await rollToNextOccurrence(item)
  await syncNextDueOf(item)
  schedulePush()
}

/** Undo a skip or a close-the-rest: the item waits again. */
export async function reopenPlanned(id: string): Promise<void> {
  const item = await db.plannedTransactions.get(id)
  if (!item || item.deleted !== 0) throw new PlannedActionError('not_found')
  if (item.status === 'open') return
  await savePlanned({ ...item, status: 'open' })
  // An occurrence waiting again is the next one due if it comes first.
  const bill = isBillPayment(item) ? await billOf(item) : null
  if (bill && item.occurrence < bill.nextDue)
    await setBillNextDue(bill.id, item.occurrence)
  schedulePush()
}

/**
 * "Not now" in the payday review: the set-asides leave the review and wait in Needs
 * confirming. Pinned, so the Automatic payday sort never picks them up again.
 */
export async function dismissFromReview(
  ids: ReadonlyArray<string>,
): Promise<void> {
  for (const id of ids) {
    const item = await db.plannedTransactions.get(id)
    if (!item || item.deleted !== 0 || !item.review) continue
    await savePlanned({ ...item, review: false, pinned: true })
  }
  schedulePush()
}

/** Due on another day. Pinned, so the generator never moves it back. */
export async function movePlanned(id: string, date: string): Promise<void> {
  const item = await openItem(id)
  await savePlanned({ ...item, date, pinned: true })
  schedulePush()
}

/** A different planned amount. Pinned, so the generator never rewrites it. */
export async function editPlannedAmount(
  id: string,
  amount: number,
): Promise<void> {
  const item = await openItem(id)
  if (!Number.isFinite(amount) || amount <= 0)
    throw new PlannedActionError('bad_amount')
  await savePlanned({ ...item, amount: Math.round(amount), pinned: true })
  await closeCovered([item.id])
  schedulePush()
}

/** Only a hand-made item can be deleted; a generated one would come back — skip it. */
export async function deleteManualPlanned(id: string): Promise<void> {
  const item = await db.plannedTransactions.get(id)
  if (!item || item.deleted !== 0) throw new PlannedActionError('not_found')
  if (item.origin !== 'manual') throw new PlannedActionError('not_manual')
  if ((await settledNow(item)) > 0)
    throw new PlannedActionError('has_settlements')
  await removePlanned([id])
  schedulePush()
}

// --- Contributions (1b) --------------------------------------------------------------

export type ContributionInput = {
  /** `now` settles it today; `later` plans it for `date`. */
  mode: 'now' | 'later'
  /** In the goal's currency. */
  amount: number
  walletId?: string | null
  /** Held outside any wallet. */
  externalLabel?: string | null
  date: string
  note?: string | null
  /** `now` only: false writes it unlinked even when a due item could take it. */
  link?: boolean
}

export type ContributionResult =
  | { kind: 'settled'; settlementId: string; plannedId: string | null }
  | { kind: 'planned'; plannedId: string }

/**
 * "+ Add contribution" on a goal: a set-aside. Now settles the goal's oldest due set-aside
 * when there is one (so it counts against the plan instead of beside it), else writes an
 * unlinked one. Plan for later writes a hand-made planned item a recalc never rewrites.
 */
export async function addContribution(
  goalId: string,
  input: ContributionInput,
): Promise<ContributionResult> {
  const goal = await db.goals.get(goalId)
  if (!goal || goal.deleted !== 0) throw new PlannedActionError('not_found')
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    throw new PlannedActionError('bad_amount')
  const role: PlannedRole = 'set_aside'

  if (input.mode === 'later') {
    const ts = new Date().toISOString()
    const plannedId = newId()
    await insertPlanned([
      {
        id: plannedId,
        origin: 'manual',
        role,
        goalId,
        incomeStreamId: null,
        billId: null,
        walletId: input.walletId ?? null,
        name: `${goal.name} set-aside`,
        amount: Math.round(input.amount),
        currency: goal.currency,
        categoryId: null,
        occurrence: input.date,
        date: input.date,
        status: 'open',
        pinned: false,
        review: false,
        note: input.note ?? null,
        createdAt: ts,
        updatedAt: ts,
        version: '',
        dirty: 1,
        deleted: 0,
      },
    ])
    schedulePush()
    return { kind: 'planned', plannedId }
  }

  const due =
    input.link === false
      ? null
      : (dueList(
          (
            await db.plannedTransactions
              .where('goalId')
              .equals(goalId)
              .toArray()
          ).filter((p) => p.role === role),
          today(),
        )[0] ?? null)
  if (due) {
    const confirmed = await confirmPlanned(due.id, {
      amount: convertMinor(
        input.amount,
        goal.currency,
        due.currency,
        await currentRates(),
      ),
      walletId: input.walletId ?? null,
      externalLabel: input.externalLabel,
      date: input.date,
      note: input.note,
    })
    return {
      kind: 'settled',
      settlementId: confirmed.settlementId,
      plannedId: due.id,
    }
  }

  const external = input.externalLabel?.trim() ?? ''
  if (!external && !input.walletId) throw new PlannedActionError('no_wallet')
  const currency = external
    ? goal.currency
    : await walletCurrency(input.walletId ?? '')
  if (!currency) throw new PlannedActionError('no_wallet')
  const settlementId = await createSetAside(
    { goalId },
    {
      source: external ? 'outside' : 'wallet',
      walletId: external ? null : (input.walletId ?? null),
      externalLabel: external || null,
      amount: convertMinor(
        input.amount,
        goal.currency,
        currency,
        await currentRates(),
      ),
      currency,
      note: input.note ?? null,
      date: input.date,
      plannedId: null,
    },
  )
  schedulePush()
  return { kind: 'settled', settlementId, plannedId: null }
}
