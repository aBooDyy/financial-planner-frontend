/**
 * The confirm dialog's words (1d): the "Planned for Sep 1 · 23 days ago" line, the live
 * effect line and the primary button. Pure, so every branch of the copy is testable.
 */
import type { LocalPlanned } from '#/db/types'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { daysBetween } from './dates'
import type { ConfirmPreview } from './preview'
import { shortDate } from './views'

/** "Planned for Sep 1 · 23 days ago" / "· in 3 days" / "· today". */
export function plannedForLine(date: string, today: string): string {
  const days = daysBetween(today, date)
  const rel =
    days === 0
      ? 'today'
      : days === 1
        ? 'tomorrow'
        : days === -1
          ? 'yesterday'
          : days < 0
            ? `${-days} days ago`
            : `in ${days} days`
  return `Planned for ${shortDate(date)} · ${rel}`
}

export type EffectTone = 'neutral' | 'good' | 'partial'

export type Effect = { text: string; tone: EffectTone }

export type EffectInput = {
  item: Pick<LocalPlanned, 'currency' | 'role'>
  preview: ConfirmPreview | null
  wallet: { name: string; currency: CurrencyCode } | null
  /** The goal's currency, for its saved / target figures. */
  goalCurrency: CurrencyCode | null
}

/**
 * "Umrah trip goes to SR 5,500 of 13,000 and is back on the SR 1,500/mo plan." /
 * "Partial: SR 500 stays open on this item. …" / "Main Checking goes to SR 24,310."
 */
export function effectLine({
  item,
  preview,
  wallet,
  goalCurrency,
}: EffectInput): Effect {
  if (!preview || preview.kind === 'empty')
    return { text: 'Enter an amount to confirm.', tone: 'neutral' }
  const money = (n: number) => formatMoney(n, item.currency)
  const lead =
    preview.kind === 'partial'
      ? `Partial: ${money(preview.leftOpen)} stays open on this item. `
      : preview.kind === 'over'
        ? `${money(preview.excess)} more than planned. `
        : ''

  let tail = ''
  const goal = preview.goal
  if (goal) {
    const gc = goalCurrency ?? item.currency
    const saved = `${formatMoney(goal.savedAfter, gc)} of ${formatMoney(goal.target, gc)}`
    if (preview.kind === 'partial') {
      tail = `${goal.name} would be ${saved}; remaining plan becomes ${formatMoney(goal.liveAmountAfter, gc)}/mo.`
    } else {
      const backOnPlan =
        goal.storedAmount !== null &&
        goal.storedAmount > 0 &&
        goal.liveAmountAfter === goal.storedAmount
      tail = backOnPlan
        ? `${goal.name} goes to ${saved} and is back on the ${formatMoney(goal.storedAmount ?? 0, gc)}/mo plan.`
        : `${goal.name} goes to ${saved}.`
    }
  } else if (preview.wallet && wallet) {
    tail = `${wallet.name} goes to ${formatMoney(preview.wallet.balanceAfter, wallet.currency)}.`
  }

  const text = `${lead}${tail}`.trim()
  return {
    text: text || 'Ready to confirm.',
    tone:
      preview.kind === 'partial'
        ? 'partial'
        : preview.kind === 'full'
          ? 'good'
          : 'neutral',
  }
}

/** "Confirm as paid" / "Confirm received" / "Confirm partial SR 1,000" / "Confirm early". */
export function primaryLabel(args: {
  role: LocalPlanned['role']
  kind: ConfirmPreview['kind']
  amount: number
  currency: CurrencyCode
  early: boolean
}): string {
  if (args.kind === 'partial')
    return `Confirm partial ${formatMoney(args.amount, args.currency)}`
  if (args.early) return 'Confirm early'
  return args.role === 'income' ? 'Confirm received' : 'Confirm as paid'
}
