/**
 * What the planner confirms on its own once a row comes due — pure:
 *
 * - a bill payment whose bill is on **auto-pay**, on its due date, from the bill's wallet;
 * - a payday whose stream is set to **log automatically**, into the stream's wallet;
 * - in **Automatic** payday mode, a payday set-aside whose wallet is the main paycheck's
 *   deposit wallet and still has the free money for it (03 §4, D17) — once that payday's pay
 *   has arrived: while the main paycheck's income row for the day is open and unconfirmed (and
 *   not being logged automatically in this same pass) the line waits, untouched. Every other
 *   due set-aside — another wallet (the money must really move), not enough free money, or no
 *   deposit wallet at all — is flagged for the payday review instead.
 *
 * Only open rows nothing settles yet are considered, and never a pinned set-aside: dismissing
 * the review ("Not now") pins it, so it is never picked up again. A closed bill or a closed or
 * paused goal has nothing set aside for it, here or in the review.
 */
import type {
  LocalBill,
  LocalGoal,
  LocalIncomeStream,
  LocalPlanned,
} from '#/db/types'
import { isStoppedOwner } from '#/features/planning/data/funding'
import type { PaydayMode } from '#/features/wallets/api/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { PLANNED_NAMESPACE, uuidv5 } from './ids'

export type AutoContext = {
  /** ISO date. */
  today: string
  paydayMode: PaydayMode
  bills: ReadonlyMap<string, LocalBill>
  goals: ReadonlyMap<string, LocalGoal>
  streams: ReadonlyMap<string, LocalIncomeStream>
  /** The main paycheck's wallet; null without one (no income, or income that varies). */
  depositWalletId: string | null
  /** The main paycheck's stream, whose payday must be confirmed before setting aside. */
  mainStreamId: string | null
  /** Free to spend per wallet, in the wallet's currency. */
  free: Readonly<Record<string, number>>
  walletCurrency: ReadonlyMap<string, CurrencyCode>
  rates: RatesMap
  isSettled: (row: LocalPlanned) => boolean
}

export type AutoSetAside = { id: string; walletId: string; amount: number }

export type AutoPlan = {
  payments: Array<{ id: string; walletId: string }>
  income: Array<{ id: string; walletId: string }>
  /** Set aside now; `amount` in the wallet's currency. */
  setAsides: AutoSetAside[]
  /** Flagged for the payday review. */
  review: string[]
}

/** The id an auto-confirm writes under, the same on every device. */
export const autoSettlementId = (plannedId: string): string =>
  uuidv5(`${plannedId}:AUTO`, PLANNED_NAMESPACE)

const tierOf = (
  row: LocalPlanned,
  ctx: AutoContext,
): [number, string, number] => {
  if (row.billId) {
    const bill = ctx.bills.get(row.billId)
    return [
      bill?.mustPay === false ? 3 : 1,
      bill?.nextDue ?? '',
      bill?.position ?? 0,
    ]
  }
  const goal = ctx.goals.get(row.goalId ?? '')
  return [
    goal?.mustHave ? 2 : 3,
    goal?.dueDate ?? '9999-12-31',
    goal?.position ?? 0,
  ]
}

/** Payday set-asides in the plan's priority: must pay, must have, then the rest. */
function byPriority(ctx: AutoContext) {
  return (a: LocalPlanned, b: LocalPlanned): number => {
    const [ta, da, pa] = tierOf(a, ctx)
    const [tb, db, pb] = tierOf(b, ctx)
    return (
      a.date.localeCompare(b.date) ||
      ta - tb ||
      da.localeCompare(db) ||
      pa - pb ||
      a.id.localeCompare(b.id)
    )
  }
}

const dueRows = (
  rows: ReadonlyArray<LocalPlanned>,
  ctx: AutoContext,
): LocalPlanned[] =>
  rows.filter(
    (p) =>
      p.deleted === 0 &&
      p.status === 'open' &&
      p.date <= ctx.today &&
      !ctx.isSettled(p),
  )

/** The auto-pay bill payments and auto-logged paydays that have come due. */
export function autoConfirms(
  rows: ReadonlyArray<LocalPlanned>,
  ctx: AutoContext,
): Pick<AutoPlan, 'payments' | 'income'> {
  const plan: Pick<AutoPlan, 'payments' | 'income'> = {
    payments: [],
    income: [],
  }
  for (const p of dueRows(rows, ctx)) {
    if (p.origin === 'bill' && p.role === 'payment') {
      const bill = ctx.bills.get(p.billId ?? '')
      if (bill?.autopay && bill.closedAt === null && bill.walletId)
        plan.payments.push({ id: p.id, walletId: bill.walletId })
    } else if (p.role === 'income') {
      const stream = ctx.streams.get(p.incomeStreamId ?? '')
      if (stream?.autolog && stream.walletId)
        plan.income.push({ id: p.id, walletId: stream.walletId })
    }
  }
  return plan
}

/**
 * Automatic mode's payday set-asides, against `ctx.free` as it stands — the runner confirms
 * `autoConfirms` first and reads free money again, so the pay just logged funds them and what
 * auto-pay just paid is already out. `logging` names paydays being logged in the same pass
 * (when the two are planned together, as `autoPlan` does).
 */
export function autoSetAsides(
  rows: ReadonlyArray<LocalPlanned>,
  ctx: AutoContext,
  logging: ReadonlySet<string> = new Set(),
): Pick<AutoPlan, 'setAsides' | 'review'> {
  const plan: Pick<AutoPlan, 'setAsides' | 'review'> = {
    setAsides: [],
    review: [],
  }
  if (ctx.paydayMode !== 'auto') return plan
  const due = dueRows(rows, ctx)
  const payNotIn = new Set(
    due
      .filter(
        (p) =>
          p.role === 'income' &&
          p.incomeStreamId !== null &&
          p.incomeStreamId === ctx.mainStreamId &&
          !logging.has(p.id),
      )
      .flatMap((p) => [p.date, p.occurrence]),
  )
  const free = { ...ctx.free }
  const setAsides = due
    .filter(
      (p) =>
        p.role === 'set_aside' &&
        (p.origin === 'goal' || p.origin === 'bill') &&
        !p.review &&
        !p.pinned &&
        !isStoppedOwner(p, ctx.bills, ctx.goals),
    )
    .sort(byPriority(ctx))
  for (const p of setAsides) {
    if (payNotIn.has(p.date)) continue
    const walletId = p.walletId
    const currency = walletId ? ctx.walletCurrency.get(walletId) : undefined
    if (!walletId || !currency || walletId !== ctx.depositWalletId) {
      plan.review.push(p.id)
      continue
    }
    const amount = convertMinor(p.amount, p.currency, currency, ctx.rates)
    if ((free[walletId] ?? 0) < amount) {
      plan.review.push(p.id)
      continue
    }
    free[walletId] = (free[walletId] ?? 0) - amount
    plan.setAsides.push({ id: p.id, walletId, amount })
  }
  return plan
}

/** Both passes over the same rows and free money (the runner splits them; see `autoSetAsides`). */
export function autoPlan(
  rows: ReadonlyArray<LocalPlanned>,
  ctx: AutoContext,
): AutoPlan {
  const confirms = autoConfirms(rows, ctx)
  const logging = new Set(confirms.income.map((i) => i.id))
  return { ...confirms, ...autoSetAsides(rows, ctx, logging) }
}
