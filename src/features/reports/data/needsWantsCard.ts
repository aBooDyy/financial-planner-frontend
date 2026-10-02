/**
 * The Reports "Needs, wants, savings" card: one bar over the period's income, the three rows
 * against the 50/30/20 guideline, the not-sorted remainder, the categories behind each bucket
 * and — over three months or more — the month-by-month split.
 */
import type { SpendClass } from '#/features/categories/api/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  SPEND_CLASSES,
  SPEND_CLASS_LABEL,
  UNSORTED_LABEL,
} from '#/features/categories/spendClass'
import type { IconId } from '#/lib/icons/catalog.gen'
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { monthBuckets } from './buckets'
import { rowsIn } from './flowRows'
import type { FlowRow } from './flowRows'
import { bucketOf, needsWantsTotals, pctText, sharesOf } from './needsWants'
import type {
  NeedsWantsShares,
  NeedsWantsTotals,
  SpendBucket,
} from './needsWants'
import type { ReportRange } from './range'

export type NwsSegmentKey = SpendBucket | 'overspent'

export type NwsSegment = {
  key: NwsSegmentKey
  label: string
  /** Width on the bar, 0–100. */
  widthPct: number
  valueStr: string
  /** "48%" of income; "40% of spending" with no income; "over income" for the excess. */
  pctStr: string
}

export type Tick = { label: string; atPct: number }

export type VerdictTone = 'good' | 'warn'

export type Verdict = {
  /** "✓", "a little over", "under". */
  text: string
  /** What the text means for a screen reader. */
  label: string
  tone: VerdictTone
}

export type NwsCategory = {
  rootId: string
  name: string
  color: string
  icon: IconId
  amountStr: string
  /** Share of the bucket: "62%". */
  shareStr: string
}

export type NwsRow = {
  key: SpendClass
  label: string
  amountStr: string
  /** Null when nothing came in. */
  pctStr: string | null
  /** "≤ 50%". */
  guideline: string
  verdict: Verdict | null
  /** "was 27%", or null without a comparison that had income. */
  wasStr: string | null
  /** Savings' detail: what was set aside for goals, put into savings categories, or overspent. */
  note: string | null
  categories: NwsCategory[]
}

export type NwsUnsorted = {
  amountStr: string
  pctStr: string | null
  /** The roots to tag — tagging a root sorts its subcategories too. */
  rootIds: string[]
  /** "Sort 2 categories". */
  actionLabel: string
  categories: NwsCategory[]
}

export type NwsMonth = {
  key: string
  label: string
  /** "June 2026: Needs 48% · Wants 31% · Savings 21%". */
  title: string
  segments: NwsSegment[]
}

export type NeedsWantsView = {
  /** "of SR 72,000 income". */
  caption: string
  /** Nothing came in, so nothing is a share of anything. */
  noIncome: boolean
  /** Neither income nor spending in the period. */
  empty: boolean
  segments: NwsSegment[]
  ticks: Tick[]
  rows: NwsRow[]
  unsorted: NwsUnsorted | null
  /** Null for a range under three months. */
  months: NwsMonth[] | null
}

const GUIDELINE: Record<SpendClass, { pct: number; most: boolean }> = {
  need: { pct: 50, most: true },
  want: { pct: 30, most: true },
  saving: { pct: 20, most: false },
}

/** Points either side of a guideline still read as "a little" over or under. */
const LITTLE = 5

const TICKS = [50, 80]

const SEGMENT_LABEL: Record<NwsSegmentKey, string> = {
  ...SPEND_CLASS_LABEL,
  unsorted: UNSORTED_LABEL,
  overspent: 'Overspent',
}

export function verdictOf(cls: SpendClass, pct: number): Verdict {
  const { pct: target, most } = GUIDELINE[cls]
  const past = most ? pct - target : target - pct
  if (past <= 0)
    return { text: '✓', label: 'within the guideline', tone: 'good' }
  const word = most ? 'over' : 'under'
  return past <= LITTLE
    ? { text: `a little ${word}`, label: `a little ${word}`, tone: 'warn' }
    : { text: word, label: word, tone: 'warn' }
}

const outflowOf = (t: NeedsWantsTotals): number => t.need + t.want + t.unsorted

/**
 * The bar's parts. Over income: needs, wants, not sorted, savings. Overspent: the same spends
 * squeezed into the income's share of the bar, then the excess in red. With no income at all
 * the bar just splits the spending.
 */
export function segmentsOf(
  t: NeedsWantsTotals,
  base: CurrencyCode,
): NwsSegment[] {
  const shares = sharesOf(t)
  const spent = outflowOf(t)
  const pctStrOf = (key: NwsSegmentKey, amount: number): string => {
    if (key === 'overspent') return 'over income'
    if (!shares) return `${Math.round((amount / spent) * 100)}% of spending`
    return `${key === 'unsorted' ? shares.unsorted : shares[key]}%`
  }
  const make = (
    key: NwsSegmentKey,
    amount: number,
    widthPct: number,
  ): NwsSegment => ({
    key,
    label: SEGMENT_LABEL[key],
    widthPct,
    valueStr: formatMoneyRounded(amount, base),
    pctStr: pctStrOf(key, amount),
  })
  const spends: [SpendBucket, number][] = [
    ['need', t.need],
    ['want', t.want],
    ['unsorted', t.unsorted],
  ]

  let parts: NwsSegment[]
  if (t.income <= 0)
    parts = spends.map(([k, v]) => make(k, v, (v / spent) * 100))
  else if (t.savings >= 0)
    parts = [
      ...spends.map(([k, v]) => make(k, v, (v / t.income) * 100)),
      make('saving', t.savings, (t.savings / t.income) * 100),
    ]
  else {
    // The bar is the whole outflow: income's share holds the spends, the rest is the excess.
    const squeeze = t.income / spent
    parts = [
      ...spends.map(([k, v]) => make(k, v, (v / spent) * squeeze * 100)),
      make('overspent', -t.savings, (-t.savings / spent) * 100),
    ]
  }
  return parts.filter((p) => p.widthPct > 0)
}

/** The 50% and 80% guideline marks, where income's share of the bar puts them. */
function ticksOf(t: NeedsWantsTotals): Tick[] {
  if (t.income <= 0) return []
  const spent = outflowOf(t)
  const scale = t.savings < 0 ? t.income / spent : 1
  return TICKS.map((p) => ({ label: `${p}`, atPct: p * scale }))
}

function categoriesIn(
  rows: ReadonlyArray<FlowRow>,
  bucket: SpendBucket,
  catalog: CategoryCatalog,
  base: CurrencyCode,
): NwsCategory[] {
  const byRoot = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    if (r.type !== 'spend' || bucketOf(catalog, r.categoryId) !== bucket)
      continue
    const rootId = catalog.rootOf(r.categoryId).id
    byRoot.set(rootId, (byRoot.get(rootId) ?? 0) + r.amount)
    total += r.amount
  }
  return [...byRoot]
    .sort((a, b) => b[1] - a[1])
    .map(([rootId, amount]) => {
      const root = catalog.get(rootId)
      return {
        rootId,
        name: root.name,
        color: root.color,
        icon: root.icon,
        amountStr: formatMoneyRounded(amount, base),
        shareStr: `${total > 0 ? Math.round((amount / total) * 100) : 0}%`,
      }
    })
}

const shareOf = (s: NeedsWantsShares, key: SpendClass): number =>
  key === 'saving' ? s.saving : s[key]

function savingsNote(
  t: NeedsWantsTotals,
  goalSetAside: number,
  base: CurrencyCode,
): string | null {
  if (t.savings < 0)
    return `Overspent by ${formatMoneyRounded(-t.savings, base)}`
  const parts: string[] = []
  if (goalSetAside > 0)
    parts.push(`${formatMoneyRounded(goalSetAside, base)} set aside for goals`)
  if (t.savedSpends > 0)
    parts.push(
      `${formatMoneyRounded(t.savedSpends, base)} into savings categories`,
    )
  return parts.length ? parts.join(' · ') : null
}

function monthsOf(
  cur: ReadonlyArray<FlowRow>,
  range: ReportRange,
  today: Date,
  catalog: CategoryCatalog,
  base: CurrencyCode,
): NwsMonth[] | null {
  const months = monthBuckets(range, today).filter((m) => !m.future)
  if (months.length < 3) return null
  return months.map((m) => {
    const t = needsWantsTotals(
      rowsIn(cur, { start: m.start, dataEnd: m.end }),
      catalog,
    )
    const shares = sharesOf(t)
    return {
      key: m.title,
      label: m.label,
      title: `${m.title}: ${
        shares
          ? SPEND_CLASSES.map(
              (c) => `${SPEND_CLASS_LABEL[c]} ${pctText(shareOf(shares, c))}`,
            ).join(' · ')
          : 'no income'
      }`,
      segments: segmentsOf(t, base),
    }
  })
}

export function buildNeedsWants(args: {
  cur: ReadonlyArray<FlowRow>
  prev: ReadonlyArray<FlowRow> | null
  /** Live goal set-asides dated in the period, in scope, base currency. */
  goalSetAside: number
  range: ReportRange
  today: Date
  catalog: CategoryCatalog
  base: CurrencyCode
}): NeedsWantsView {
  const { cur, prev, goalSetAside, range, today, catalog, base } = args
  const t = needsWantsTotals(cur, catalog)
  const shares = sharesOf(t)
  const was = prev ? sharesOf(needsWantsTotals(prev, catalog)) : null

  const amountOf = (key: SpendClass): number =>
    key === 'saving' ? t.savings : t[key]

  const rows = SPEND_CLASSES.map((key): NwsRow => {
    const pct = shares ? shareOf(shares, key) : null
    const amount = amountOf(key)
    return {
      key,
      label: SPEND_CLASS_LABEL[key],
      amountStr: `${amount < 0 ? '−' : ''}${formatMoneyRounded(Math.abs(amount), base)}`,
      pctStr: pct === null ? null : pctText(pct),
      guideline: `${GUIDELINE[key].most ? '≤' : '≥'} ${GUIDELINE[key].pct}%`,
      verdict: pct === null ? null : verdictOf(key, pct),
      wasStr: was ? `was ${pctText(shareOf(was, key))}` : null,
      note: key === 'saving' ? savingsNote(t, goalSetAside, base) : null,
      categories: categoriesIn(cur, key, catalog, base),
    }
  })

  const unsortedCategories = categoriesIn(cur, 'unsorted', catalog, base)
  const n = unsortedCategories.length
  const unsorted: NwsUnsorted | null =
    t.unsorted > 0
      ? {
          amountStr: formatMoneyRounded(t.unsorted, base),
          pctStr: shares ? `${shares.unsorted}%` : null,
          rootIds: unsortedCategories.map((c) => c.rootId),
          actionLabel: `Sort ${n} ${n === 1 ? 'category' : 'categories'}`,
          categories: unsortedCategories,
        }
      : null

  return {
    caption:
      t.income > 0
        ? `of ${formatMoneyRounded(t.income, base)} income`
        : 'No income in this period',
    noIncome: t.income <= 0,
    empty: t.income <= 0 && outflowOf(t) + t.savedSpends <= 0,
    segments: segmentsOf(t, base),
    ticks: ticksOf(t),
    rows,
    unsorted,
    months: monthsOf(cur, range, today, catalog, base),
  }
}
