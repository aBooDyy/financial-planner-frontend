/**
 * What the user does to a planned item: confirm it (fully or in part), close the rest, skip
 * it, move it, change its amount — and add a contribution to a goal, now or for later. All
 * local-first: Dexie writes plus outbox entries, working offline.
 *
 * Confirming writes the real thing, linked back by `plannedId`: an ordinary transaction for
 * income and payments, a dated reservation for a set-aside. The item's status follows from
 * what settles it (`rows.ts#closeCovered`), so a partial leaves it open with a remainder.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { buildCatalog } from '#/features/categories/data/catalog'
import { createAllocation } from '#/features/goals/data/mutations'
import type { PlannedRole } from '#/features/planned/api/types'
import {
  advanceRecurring,
  createTransaction,
} from '#/features/transactions/data/mutations'
import { advanceDue } from '#/features/transactions/data/planning'
import type { TxType } from '#/features/transactions/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { isoOf } from './dates'
import {
  closeCovered,
  currentRates,
  insertPlanned,
  removePlanned,
  savePlanned,
  settlementsOf,
} from './rows'
import { dueList, indexSettlements, settledOf } from './settle'

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
  const { txns, allocations } = await settlementsOf([item.id])
  return settledOf(
    item,
    indexSettlements(txns, allocations),
    await currentRates(),
  )
}

/** Keep a Spending schedule's `nextDue` past every occurrence the user has dealt with. */
async function advanceSchedulePast(item: LocalPlanned): Promise<void> {
  if (item.origin !== 'recurring' || !item.recurringId) return
  const r = await db.recurrings.get(item.recurringId)
  if (!r || r.deleted !== 0 || r.nextDue > item.occurrence) return
  let next = r.nextDue
  while (next <= item.occurrence) next = advanceDue(next, r.frequency)
  await advanceRecurring(r.id, next)
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

async function walletCurrency(walletId: string): Promise<CurrencyCode | null> {
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
  note?: string | null
  /** Provenance marker for the transaction (the auto-poster marks its rows). */
  source?: string | null
}

export type ConfirmResult = {
  settlementId: string
  kind: 'transaction' | 'allocation'
  /** The item's status after the settlement landed. */
  status: LocalPlanned['status']
}

/**
 * Settle a planned item: write the transaction or reservation it stands for, linked back to
 * it. Settling the whole remainder (or more — the excess still counts) closes it; less
 * leaves it open with a smaller remainder.
 */
export async function confirmPlanned(
  id: string,
  input: ConfirmInput = {},
): Promise<ConfirmResult> {
  const item = await openItem(id)
  // A set-aside is a reservation on its goal; with the goal gone there is nothing to hold it.
  const goalId = item.goalId
  if (item.role === 'set_aside' && !(goalId && (await db.goals.get(goalId))))
    throw new PlannedActionError('origin_gone')
  const rates = await currentRates()
  const remainder = Math.max(0, item.amount - (await settledNow(item)))
  const amount = input.amount ?? remainder
  if (!Number.isFinite(amount) || amount <= 0)
    throw new PlannedActionError('bad_amount')
  const date = input.date ?? today()
  const walletId = input.walletId !== undefined ? input.walletId : item.walletId
  const external = item.role === 'set_aside' ? input.externalLabel?.trim() : ''

  let result: Omit<ConfirmResult, 'status'>
  if (item.role === 'set_aside' && external) {
    const settlementId = await createAllocation({
      goalId: goalId ?? '',
      source: 'external',
      walletId: null,
      externalLabel: external,
      amount,
      currency: item.currency,
      note: input.note ?? null,
      date,
      plannedId: item.id,
    })
    result = { settlementId, kind: 'allocation' }
  } else {
    const currency = walletId ? await walletCurrency(walletId) : null
    if (!walletId || !currency) throw new PlannedActionError('no_wallet')
    const inWallet = convertMinor(amount, item.currency, currency, rates)
    if (item.role === 'set_aside') {
      const settlementId = await createAllocation({
        goalId: goalId ?? '',
        source: 'wallet',
        walletId,
        externalLabel: null,
        amount: inWallet,
        currency,
        note: input.note ?? null,
        date,
        plannedId: item.id,
      })
      result = { settlementId, kind: 'allocation' }
    } else {
      const type: TxType = item.role === 'income' ? 'income' : 'spend'
      const wanted =
        input.categoryId !== undefined ? input.categoryId : item.categoryId
      const settlementId = await createTransaction({
        type,
        amount: inWallet,
        currency,
        categoryId: await categoryFor(type, wanted),
        walletId,
        goalId: type === 'spend' ? await goalIdOf(item) : null,
        date,
        note: input.note !== undefined ? input.note : item.name,
        source: input.source ?? null,
        plannedId: item.id,
      })
      result = { settlementId, kind: 'transaction' }
    }
  }

  const after = await db.plannedTransactions.get(item.id)
  if (after?.status === 'done') await advanceSchedulePast(item)
  schedulePush()
  return { ...result, status: after?.status ?? 'open' }
}

/** A payment toward a goal carries the goal, whichever origin planned it. */
async function goalIdOf(item: LocalPlanned): Promise<string | null> {
  if (item.goalId) return item.goalId
  if (item.origin !== 'recurring' || !item.recurringId) return null
  return (await db.recurrings.get(item.recurringId))?.goalId ?? null
}

/** Done, with whatever is still open abandoned — the goal is simply behind by that much. */
export async function closeRest(id: string): Promise<void> {
  const item = await openItem(id)
  await savePlanned({ ...item, status: 'done' })
  await advanceSchedulePast(item)
  schedulePush()
}

/** Consciously not happening. Only while nothing settles it — otherwise close the rest. */
export async function skipPlanned(id: string): Promise<void> {
  const item = await openItem(id)
  if ((await settledNow(item)) > 0)
    throw new PlannedActionError('has_settlements')
  await savePlanned({ ...item, status: 'skipped' })
  await advanceSchedulePast(item)
  schedulePush()
}

/** Undo a skip or a close-the-rest: the item waits again. */
export async function reopenPlanned(id: string): Promise<void> {
  const item = await db.plannedTransactions.get(id)
  if (!item || item.deleted !== 0) throw new PlannedActionError('not_found')
  if (item.status === 'open') return
  await savePlanned({ ...item, status: 'open' })
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

/** Obligations are paid (money leaves); everything else is saved toward (money stays). */
export const contributionRoleOf = (
  goal: Pick<LocalGoal, 'kind'>,
): PlannedRole => (goal.kind === 'recurring' ? 'payment' : 'set_aside')

export type ContributionInput = {
  /** `now` settles it today; `later` plans it for `date`. */
  mode: 'now' | 'later'
  /** In the goal's currency. */
  amount: number
  walletId?: string | null
  /** Set-asides only: held outside any wallet. */
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
 * "+ Add contribution" on a goal. Paid now settles the goal's oldest due item when there is
 * one (so it counts against the plan instead of beside it), else writes an unlinked
 * contribution. Plan for later writes a hand-made planned item a recalc never rewrites.
 */
export async function addContribution(
  goalId: string,
  input: ContributionInput,
): Promise<ContributionResult> {
  const goal = await db.goals.get(goalId)
  if (!goal || goal.deleted !== 0) throw new PlannedActionError('not_found')
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    throw new PlannedActionError('bad_amount')
  const role = contributionRoleOf(goal)

  if (input.mode === 'later') {
    const ts = new Date().toISOString()
    const plannedId = crypto.randomUUID()
    await insertPlanned([
      {
        id: plannedId,
        origin: 'manual',
        role,
        goalId,
        incomeStreamId: null,
        recurringId: null,
        walletId: input.walletId ?? null,
        name: role === 'payment' ? goal.name : `${goal.name} set-aside`,
        amount: Math.round(input.amount),
        currency: goal.currency,
        categoryId: null,
        occurrence: input.date,
        date: input.date,
        status: 'open',
        pinned: false,
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

  const external = role === 'set_aside' ? input.externalLabel?.trim() : ''
  if (!external && !input.walletId) throw new PlannedActionError('no_wallet')
  let settlementId: string
  if (role === 'set_aside') {
    const currency = external
      ? goal.currency
      : await walletCurrency(input.walletId ?? '')
    if (!currency) throw new PlannedActionError('no_wallet')
    settlementId = await createAllocation({
      goalId,
      source: external ? 'external' : 'wallet',
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
    })
  } else {
    const walletId = input.walletId ?? ''
    const currency = await walletCurrency(walletId)
    if (!currency) throw new PlannedActionError('no_wallet')
    settlementId = await createTransaction({
      type: 'spend',
      amount: convertMinor(
        input.amount,
        goal.currency,
        currency,
        await currentRates(),
      ),
      currency,
      categoryId: await categoryFor('spend', null),
      walletId,
      goalId,
      date: input.date,
      note: input.note ?? goal.name,
      plannedId: null,
    })
  }
  schedulePush()
  return { kind: 'settled', settlementId, plannedId: null }
}
