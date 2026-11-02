/**
 * What if's words and comparison: whether the tried items fit, each item's line, what they would
 * change in the plan, and the paycheck now against the paycheck with them. Pure.
 */
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { EachPaycheck, Verdict } from '#/features/planning/data/paycheck'
import type {
  ItemOutcome,
  KnockOn,
  WhatIfItem,
  WhatIfResult,
} from '#/features/planning/data/whatIf'
import type { CurrencyCode } from '#/lib/currency'
import { dayMonth, money, monthYear, perPeriod, signedMoney } from './format'
import { PART_COLOR, paycheckBar } from './overview'
import type { PaycheckPartKey } from './overview'

export type WhatIfHeadline = {
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
  title: string
  sub: string
}

const shortOf = (v: Verdict): number => (v.kind === 'short' ? v.shortBy : 0)

/** The answer to "can I have this?". */
export function whatIfHeadline(
  result: WhatIfResult,
  base: CurrencyCode,
  calendar: PayCalendar,
): WhatIfHeadline {
  const { before, after } = result
  const per = perPeriod(calendar)
  const v = after.verdict
  const leftBefore = before.paycheck.left
  const leftLine =
    leftBefore !== null && 'left' in v && v.left !== leftBefore
      ? `${money(Math.max(0, v.left), base)} would be left for spending ${per}, instead of ${signedMoney(leftBefore, base)}.`
      : 'left' in v
        ? `${money(Math.max(0, v.left), base)} would be left for spending ${per}.`
        : ''
  switch (v.kind) {
    case 'start':
      return {
        tone: 'neutral',
        title: 'Add your income to see if it fits',
        sub: 'We need to know what comes in before we can compare.',
      }
    case 'covered':
      return { tone: 'ok', title: 'Yes, you can fit this', sub: leftLine }
    case 'tight':
      return { tone: 'warn', title: 'It fits, but it’s tight', sub: leftLine }
    case 'short': {
      const already = shortOf(before.verdict) > 0
      const amount = money(v.shortBy, base)
      if (v.per === 'paycheck')
        return {
          tone: 'danger',
          title: `You’d be short by ${amount} ${per}`,
          sub: already
            ? 'Your plan is already short, and this adds to it.'
            : 'This asks for more than comes in. Try a smaller amount, a later date, or switching something off.',
        }
      return {
        tone: 'danger',
        title: `You’d be short by ${amount}`,
        sub: 'Each paycheck fits, but not every date can be met. A later date may be all it takes.',
      }
    }
  }
}

export const tryoutName = (
  item: WhatIfItem,
  categoryName: (id: string) => string,
): string =>
  item.kind === 'everyday'
    ? categoryName(item.draft.categoryId ?? '')
    : item.draft.name

export const tryoutColor = (
  item: WhatIfItem,
  categoryColor: (id: string) => string,
): string =>
  item.kind === 'everyday'
    ? categoryColor(item.draft.categoryId ?? '')
    : item.draft.color

const KIND_LABEL: Record<WhatIfItem['kind'], string> = {
  bill: 'Bill',
  goal: 'Goal',
  everyday: 'Everyday spending',
}

/** "Goal · SR 940 a paycheck · ready by Jun 2027". */
export function tryoutLine(
  item: WhatIfItem,
  outcome: ItemOutcome | undefined,
  calendar: PayCalendar,
): string {
  const kind = KIND_LABEL[item.kind]
  if (!item.on || !outcome) return `${kind} · left out`
  const per = `${money(outcome.perPaycheck, outcome.currency)} ${perPeriod(calendar)}`
  if (item.kind === 'bill')
    return outcome.perPaycheck > 0
      ? `${kind} · ${per}`
      : `${kind} · due before your next paycheck, from what’s free`
  if (item.kind === 'goal' && outcome.finish)
    return `${kind} · ${per} · done around ${monthYear(outcome.finish)}`
  return `${kind} · ${per}`
}

/** The item's own verdict, when it has one. */
export function tryoutProblem(outcome: ItemOutcome | undefined): string | null {
  if (!outcome || outcome.shortBy <= 0) return null
  const short = `Short ${money(outcome.shortBy, outcome.currency)}`
  return outcome.slipsTo ? `${short}, or ${monthYear(outcome.slipsTo)}` : short
}

/** "Car fund would be done around Aug 2027, not Jun 2027." */
export function knockOnLine(k: KnockOn, calendar: PayCalendar): string {
  switch (k.change) {
    case 'short':
      return k.deadline
        ? `${k.name} would be ${money(k.shortBy, k.currency)} short by ${k.kind === 'goal' ? monthYear(k.deadline) : dayMonth(k.deadline)}.`
        : `${k.name} would be ${money(k.shortBy, k.currency)} short.`
    case 'later':
      return `${k.name} would be done around ${monthYear(k.to)}, not ${monthYear(k.from)}.`
    case 'slower':
      return `${k.name} would get ${money(k.to, k.currency)} ${perPeriod(calendar)}, not ${money(k.from, k.currency)}.`
  }
}

export type CompareRow = {
  key: PaycheckPartKey
  label: string
  color: string
  now: number
  then: number
}

export type CompareBar = {
  label: string
  segments: Array<{ key: PaycheckPartKey; color: string; pct: number }>
}

export type PaycheckCompare = {
  rows: CompareRow[]
  bars: CompareBar[]
  /** Where the pay ends on both bars (0–100) when either plan outruns it; null otherwise. */
  payAt: number | null
}

const ORDER: ReadonlyArray<PaycheckPartKey> = [
  'bills',
  'savingUp',
  'everyday',
  'goals',
  'left',
]

/** The paycheck now and with the tried items, drawn on one scale so the two can be compared. */
export function comparePaycheck(
  before: EachPaycheck,
  after: EachPaycheck,
  base: CurrencyCode,
  calendar: PayCalendar,
): PaycheckCompare {
  const barBefore = paycheckBar(before, base, calendar)
  const barAfter = paycheckBar(after, base, calendar)
  const amountOf = (bar: typeof barBefore, key: PaycheckPartKey) =>
    bar.legend.find((s) => s.key === key)?.amount ?? 0
  const scale = Math.max(after.income ?? 0, before.planned, after.planned, 1)
  const rows = ORDER.flatMap((key): CompareRow[] => {
    const now = amountOf(barBefore, key)
    const then = amountOf(barAfter, key)
    if (now === 0 && then === 0) return []
    const label =
      barAfter.legend.find((s) => s.key === key)?.label ??
      barBefore.legend.find((s) => s.key === key)?.label ??
      key
    return [{ key, label, color: PART_COLOR[key], now, then }]
  })
  const barOf = (label: string, pick: 'now' | 'then'): CompareBar => ({
    label,
    segments: rows
      .filter((r) => r[pick] > 0)
      .map((r) => ({
        key: r.key,
        color: r.color,
        pct: (r[pick] / scale) * 100,
      })),
  })
  const outruns = (after.left ?? 0) < 0 || (before.left ?? 0) < 0
  return {
    rows,
    bars: [barOf('Now', 'now'), barOf('With this', 'then')],
    payAt:
      after.income !== null && outruns ? (after.income / scale) * 100 : null,
  }
}
