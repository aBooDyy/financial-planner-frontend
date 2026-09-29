/**
 * The stored running totals over the ledger: what each row adds to them, how a write moves
 * them, and the figures screens read back. Sums stay in each row's own currency, so a rate
 * change needs no rewrite; conversion happens on read.
 */
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type {
  LedgerTotalKind,
  LocalBalanceNode,
  LocalLedgerTotal,
  LocalTransaction,
} from '#/db/types'
import { signOf } from './ledger'

type RatesMap = Partial<Record<string, number>>

const totalId = (
  kind: LedgerTotalKind,
  ref: string,
  currency: CurrencyCode | null,
): string =>
  currency === null ? `${kind}:${ref}` : `${kind}:${ref}:${currency}`

const unit = (
  kind: LedgerTotalKind,
  ref: string,
  currency: CurrencyCode | null = null,
  sum = 0,
): LocalLedgerTotal => ({
  id: totalId(kind, ref, currency),
  kind,
  ref,
  currency,
  sum,
  count: 1,
})

/**
 * What one row adds to the totals. Currencies count every row, deleted ones included; the
 * rest count live rows only.
 */
export function contributionsOf(t: LocalTransaction): LocalLedgerTotal[] {
  const out: LocalLedgerTotal[] = []
  if (t.currency) out.push(unit('currency', t.currency))
  if (t.deleted !== 0) return out
  if (t.walletId)
    out.push(unit('wallet', t.walletId, t.currency, signOf(t) * t.amount))
  if (t.categoryId) out.push(unit('category', t.categoryId))
  if (t.merchantId) out.push(unit('merchant', t.merchantId))
  return out
}

/** Adds (or, with `sign` -1, takes away) what `rows` contribute, keyed by total id. */
export function accumulate(
  into: Map<string, LocalLedgerTotal>,
  rows: ReadonlyArray<LocalTransaction>,
  sign: 1 | -1 = 1,
): void {
  for (const row of rows) {
    for (const c of contributionsOf(row)) {
      const prev = into.get(c.id)
      into.set(c.id, {
        ...c,
        sum: (prev?.sum ?? 0) + sign * c.sum,
        count: (prev?.count ?? 0) + sign * c.count,
      })
    }
  }
}

/** The totals of a whole ledger, from scratch. */
export function totalsOf(
  rows: ReadonlyArray<LocalTransaction>,
): LocalLedgerTotal[] {
  const out = new Map<string, LocalLedgerTotal>()
  accumulate(out, rows)
  return [...out.values()]
}

/** How replacing `before` with `after` moves the totals; entries that net to nothing are dropped. */
export function totalsDiff(
  before: ReadonlyArray<LocalTransaction>,
  after: ReadonlyArray<LocalTransaction>,
): LocalLedgerTotal[] {
  const out = new Map<string, LocalLedgerTotal>()
  accumulate(out, before, -1)
  accumulate(out, after)
  return [...out.values()].filter((d) => d.sum !== 0 || d.count !== 0)
}

/**
 * Folds a diff into the stored rows it touches (`stored[i]` is the row for `diff[i]`, if any).
 * A total whose count reaches zero is removed rather than kept at zero.
 */
export function applyTotalsDiff(
  stored: ReadonlyArray<LocalLedgerTotal | undefined>,
  diff: ReadonlyArray<LocalLedgerTotal>,
): { put: LocalLedgerTotal[]; remove: string[] } {
  const put: LocalLedgerTotal[] = []
  const remove: string[] = []
  diff.forEach((d, i) => {
    const count = (stored[i]?.count ?? 0) + d.count
    if (count <= 0) remove.push(d.id)
    else put.push({ ...d, sum: (stored[i]?.sum ?? 0) + d.sum, count })
  })
  return { put, remove }
}

/** Whether two sets of totals agree, in any order. */
export function sameTotals(
  a: ReadonlyArray<LocalLedgerTotal>,
  b: ReadonlyArray<LocalLedgerTotal>,
): boolean {
  if (a.length !== b.length) return false
  const byId = new Map(b.map((t) => [t.id, t]))
  return a.every((t) => {
    const other = byId.get(t.id)
    return other !== undefined && other.sum === t.sum && other.count === t.count
  })
}

/**
 * Each live wallet's signed delta over the whole ledger, in the wallet's own currency — the
 * figure `walletDeltas` derives from the rows, read from `wallet` totals instead.
 */
export function walletDeltasFromTotals(
  nodes: ReadonlyArray<LocalBalanceNode>,
  totals: ReadonlyArray<LocalLedgerTotal>,
  rates: RatesMap,
): Record<string, number> {
  const currencyOf = new Map<string, CurrencyCode>()
  for (const n of nodes) {
    if (n.kind === 'wallet' && n.deleted === 0)
      currencyOf.set(n.id, n.currency ?? 'SAR')
  }
  const out: Record<string, number> = {}
  for (const t of totals) {
    if (t.kind !== 'wallet' || t.currency === null) continue
    const cur = currencyOf.get(t.ref)
    if (!cur) continue
    out[t.ref] = (out[t.ref] ?? 0) + convertMinor(t.sum, t.currency, cur, rates)
  }
  return out
}

/** Live rows per id, from one kind of count total. */
export function countsFromTotals(
  totals: ReadonlyArray<LocalLedgerTotal>,
): Map<string, number> {
  return new Map(totals.map((t) => [t.ref, t.count]))
}
