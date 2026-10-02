/**
 * Needs, wants, savings (50/30/20): the period's income split by what it went on. Savings is
 * the remainder — income not spent on needs, wants or still-unsorted categories — so spends
 * filed under a Savings category (investing, say) count toward it rather than against it.
 */
import type { LocalTransaction } from '#/db/types'
import type { SpendClass } from '#/features/categories/api/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { RatesMap } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { flowRowsOf } from './flowRows'
import type { FlowRow } from './flowRows'

/** Where a spend lands: a tagged bucket, or not sorted yet. */
export type SpendBucket = SpendClass | 'unsorted'

export const bucketOf = (
  catalog: CategoryCatalog,
  categoryId: string,
): SpendBucket => catalog.classOf(categoryId) ?? 'unsorted'

/** A spend filed under a Savings category: money kept, not spent. */
export const isSavingSpend = (
  catalog: CategoryCatalog,
  row: Pick<FlowRow, 'type' | 'categoryId'>,
): boolean =>
  row.type === 'spend' && catalog.classOf(row.categoryId) === 'saving'

/** Base-currency minor units. */
export type NeedsWantsTotals = {
  income: number
  need: number
  want: number
  unsorted: number
  /** Spends filed under Savings categories — already inside `savings`. */
  savedSpends: number
  /** income − need − want − unsorted; negative when more went out than came in. */
  savings: number
}

export function needsWantsTotals(
  rows: ReadonlyArray<FlowRow>,
  catalog: CategoryCatalog,
): NeedsWantsTotals {
  const t = { income: 0, need: 0, want: 0, unsorted: 0, savedSpends: 0 }
  for (const r of rows) {
    if (r.type === 'income') {
      t.income += r.amount
      continue
    }
    const bucket = bucketOf(catalog, r.categoryId)
    if (bucket === 'saving') t.savedSpends += r.amount
    else t[bucket] += r.amount
  }
  return { ...t, savings: t.income - t.need - t.want - t.unsorted }
}

/** Whole percentages of income; null when nothing came in. */
export type NeedsWantsShares = {
  need: number
  want: number
  unsorted: number
  /** Negative when overspent. */
  saving: number
}

/**
 * Each part's whole percentage of income. While nothing is overspent the four parts are the
 * whole income, so they are rounded to add up to exactly 100.
 */
export function sharesOf(t: NeedsWantsTotals): NeedsWantsShares | null {
  if (t.income <= 0) return null
  const pct = (v: number) => (v / t.income) * 100
  if (t.savings < 0)
    return {
      need: Math.round(pct(t.need)),
      want: Math.round(pct(t.want)),
      unsorted: Math.round(pct(t.unsorted)),
      saving: Math.round(pct(t.savings)),
    }
  const [need, want, unsorted, saving] = roundTo100([
    pct(t.need),
    pct(t.want),
    pct(t.unsorted),
    pct(t.savings),
  ])
  return { need, want, unsorted, saving }
}

/** Largest remainder: whole numbers that keep the parts' sum at 100. */
export function roundTo100(parts: ReadonlyArray<number>): number[] {
  const floors = parts.map(Math.floor)
  let left = 100 - floors.reduce((s, v) => s + v, 0)
  const order = parts
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] += 1
    left -= 1
  }
  return floors
}

/** "21%", or "−4%" with a true minus sign. */
export const pctText = (pct: number): string =>
  `${pct < 0 ? '−' : ''}${Math.abs(pct)}%`

/** "Needs 48% · Wants 31% · Savings 21%" — not sorted only when there is some. */
export function sharesLine(s: NeedsWantsShares): string {
  const parts = [`Needs ${pctText(s.need)}`, `Wants ${pctText(s.want)}`]
  if (s.unsorted > 0) parts.push(`Not sorted ${pctText(s.unsorted)}`)
  parts.push(`Savings ${pctText(s.saving)}`)
  return parts.join(' · ')
}

export type NeedsWantsSummary = {
  totals: NeedsWantsTotals
  /** Null when nothing came in. */
  shares: NeedsWantsShares | null
  /** `sharesLine(shares)`, or null when nothing came in. */
  line: string | null
}

/**
 * The split for any span of the ledger, all accounts — what a one-line summary (Planning's
 * "Last month: Needs 48% · Wants 31% · Savings 21%") reads. `rows` may hold any types and
 * dates; only live spend and income from `from` to `to` (ISO, inclusive) count.
 */
export function needsWantsSummary(args: {
  rows: ReadonlyArray<LocalTransaction>
  from: string
  to: string
  catalog: CategoryCatalog
  base: CurrencyCode
  rates: RatesMap
}): NeedsWantsSummary {
  const { rows, from, to, catalog, base, rates } = args
  const flow = flowRowsOf(rows, () => true, base, rates).filter(
    (r) => r.date >= from && r.date <= to,
  )
  const totals = needsWantsTotals(flow, catalog)
  const shares = sharesOf(totals)
  return { totals, shares, line: shares ? sharesLine(shares) : null }
}
