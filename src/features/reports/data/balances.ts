import type { LocalBalanceNode, LocalTransaction } from '#/db/types'
import { walletDeltas } from '#/features/transactions/data/ledger'
import { fmtShort, ymd } from '#/features/transactions/data/planning'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, toMajor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { balanceMoney, signedMoney } from './delta'
import type { ReportRange } from './range'

/** The chosen accounts' combined balance, in base currency, at the end of an ISO day. */
export type BalanceAt = (throughIso: string) => number

type BalanceInputs = {
  /** The wallets in scope. */
  wallets: ReadonlyArray<LocalBalanceNode>
  /** Each wallet's signed delta from every row dated before the period. */
  before: Readonly<Record<string, number>>
  /** The period's rows, of any type: a balance moves with transfers and adjustments too. */
  rows: ReadonlyArray<LocalTransaction>
  base: CurrencyCode
  rates: RatesMap
}

/**
 * Reads a balance at any day of the period: each wallet's opening amount, plus what came
 * before the period, plus the period's rows up to that day — converted to base per wallet.
 */
export function balanceAt({
  wallets,
  before,
  rows,
  base,
  rates,
}: BalanceInputs): BalanceAt {
  const nodes = [...wallets]
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return (throughIso) => {
    const upTo = sorted.filter((t) => t.date <= throughIso)
    const deltas = walletDeltas(nodes, upTo, rates)
    return nodes.reduce((sum, w) => {
      const own = (w.amount ?? 0) + (before[w.id] ?? 0) + (deltas[w.id] ?? 0)
      return sum + convertMinor(own, w.currency ?? base, base, rates)
    }, 0)
  }
}

export type BalanceStrip = {
  startStr: string
  startDate: string
  /** "Balance today" while the period runs, else "Ending balance". */
  endLabel: string
  endStr: string
  endDate: string
  changeStr: string
  changePositive: boolean
  /** Why the change is or isn't the period's net. */
  note: string
}

const dayCaption = (d: Date): string => `${fmtShort(d)}, ${d.getFullYear()}`

/** The day before `d`, as ISO. */
const dayBefore = (d: Date): string =>
  ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))

export function buildBalanceStrip(
  read: BalanceAt,
  range: ReportRange,
  flows: { net: number; savedSpends: number },
  allAccounts: boolean,
  base: CurrencyCode,
): BalanceStrip {
  const start = read(dayBefore(range.start))
  const end = read(ymd(range.dataEnd))
  const change = end - start
  // Whole units, so a conversion's rounding never claims the two differ.
  const same = (a: number, b: number) =>
    Math.round(toMajor(a, base)) === Math.round(toMajor(b, base))
  const note = same(change, flows.net)
    ? 'Equals net for the period'
    : flows.savedSpends > 0 && same(change, flows.net - flows.savedSpends)
      ? 'Net less what went into savings categories'
      : allAccounts
        ? 'Net plus balance adjustments'
        : 'Includes transfers in and out'
  return {
    startStr: balanceMoney(start, base),
    startDate: dayCaption(range.start),
    endLabel: range.partial ? 'Balance today' : 'Ending balance',
    endStr: balanceMoney(end, base),
    endDate: dayCaption(range.dataEnd),
    changeStr: signedMoney(change, base),
    changePositive: change >= 0,
    note,
  }
}
