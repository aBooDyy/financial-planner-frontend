/**
 * Wallets' headline (03 §8, D13): Safe to spend, the window it covers, and the arithmetic
 * under it — every line a figure the user can check, ending in the headline itself. Pure.
 */
import { daysBetween } from '#/features/planned/data/dates'
import type { SafeToSpend } from '#/features/planning/data/safeToSpend'
import { dayMonth } from '#/features/planning/view/format'
import type { BudgetLeft } from '#/features/transactions/data/selectors'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** Where a line of the arithmetic leads: the wallets' set-asides, or Planning › Upcoming. */
export type SafeLineLink = 'setAsides' | 'upcoming'

export type SafeHeaderLine = {
  key: 'balance' | 'setAside' | 'bills' | 'setAsides' | 'income'
  op: '' | '−' | '+'
  label: string
  /** A quiet note after the label: "not set aside yet". */
  hint: string | null
  amountStr: string
  link: SafeLineLink | null
}

export type SafeHeaderView = {
  safeStr: string
  negative: boolean
  /** "until payday · Oct 25", "until Oct 31", "next 14 days". */
  windowStr: string
  /** "SR 300 short before payday", when Safe to spend is below zero. */
  shortStr: string | null
  lines: SafeHeaderLine[]
  /** "Budgets left until payday: Groceries SR 600.00 · Dining SR 150.00". */
  budgetsStr: string | null
}

const BUDGETS_SHOWN = 3

/** The window, as the subtitle says it and as the lines end ("before payday"). */
function windowWords(
  safe: SafeToSpend,
  today: string,
): { title: string; within: string } {
  if (safe.payday)
    return {
      title: `until payday · ${dayMonth(safe.payday)}`,
      within: 'before payday',
    }
  if (safe.horizon === 'end_of_month')
    return {
      title: `until ${dayMonth(safe.end)}`,
      within: `by ${dayMonth(safe.end)}`,
    }
  const days = daysBetween(today, safe.end)
  return { title: `next ${days} days`, within: `in the next ${days} days` }
}

const WINDOW_PHRASE: Record<string, string> = {
  'this paycheck': 'until payday',
}

/** The budgets caption (D18): what each still allows, never subtracted from the headline. */
export function budgetsCaption(
  budgets: ReadonlyArray<BudgetLeft>,
): string | null {
  if (budgets.length === 0) return null
  const windows = new Set(budgets.map((b) => b.windowLabel))
  const [only] = windows
  const when = windows.size === 1 ? ` ${WINDOW_PHRASE[only] ?? only}` : ''
  const items = budgets
    .slice(0, BUDGETS_SHOWN)
    .map((b) =>
      b.left < 0
        ? `${b.name} over by ${formatMoney(-b.left, b.currency)}`
        : `${b.name} ${formatMoney(b.left, b.currency)}`,
    )
  const more = budgets.length - BUDGETS_SHOWN
  return `Budgets left${when}: ${items.join(' · ')}${more > 0 ? ` · +${more} more` : ''}`
}

export function safeHeaderView(args: {
  safe: SafeToSpend
  base: CurrencyCode
  today: string
  budgets: ReadonlyArray<BudgetLeft>
}): SafeHeaderView {
  const { safe, base } = args
  const fmt = (minor: number) => formatMoney(minor, base)
  const words = windowWords(safe, args.today)
  const lines: SafeHeaderLine[] = [
    {
      key: 'balance',
      op: '',
      label: 'Balance',
      hint: null,
      amountStr: fmt(safe.balance),
      link: null,
    },
    {
      key: 'setAside',
      op: '−',
      label: 'Set aside',
      hint: null,
      amountStr: fmt(safe.setAside),
      link: 'setAsides',
    },
    {
      key: 'bills',
      op: '−',
      label: `Bills ${words.within}`,
      hint: 'not set aside yet',
      amountStr: fmt(safe.bills.total),
      link: 'upcoming',
    },
  ]
  if (safe.setAsides.total > 0)
    lines.push({
      key: 'setAsides',
      op: '−',
      label: `To set aside ${words.within}`,
      hint: 'for what’s due later',
      amountStr: fmt(safe.setAsides.total),
      link: 'upcoming',
    })
  if (safe.income.total > 0)
    lines.push({
      key: 'income',
      op: '+',
      label: `Income ${words.within}`,
      hint: null,
      amountStr: fmt(safe.income.total),
      link: 'upcoming',
    })
  return {
    safeStr: safe.safe < 0 ? `−${fmt(-safe.safe)}` : fmt(safe.safe),
    negative: safe.safe < 0,
    windowStr: words.title,
    shortStr:
      safe.shortBy > 0 ? `${fmt(safe.shortBy)} short ${words.within}` : null,
    lines,
    budgetsStr: budgetsCaption(args.budgets),
  }
}
