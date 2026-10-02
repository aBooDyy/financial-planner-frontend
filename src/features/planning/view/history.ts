/**
 * A bill's or goal's history for its detail panel: set-asides made (and freed), payments or
 * spending, and skipped occurrences — latest first. Pure.
 */
import type { LocalPlanned, LocalSetAside, LocalTransaction } from '#/db/types'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { money } from './format'

export type HistoryLine = {
  key: string
  date: string
  label: string
  sub: string
  /** "+SR 300", "−SR 3,000" or "—". */
  amount: string
  tone: 'in' | 'out' | 'none'
}

export const HISTORY_SHOWN = 15

export function historyOf(args: {
  kind: 'bill' | 'goal'
  id: string
  currency: CurrencyCode
  txns: ReadonlyArray<LocalTransaction>
  setAsides: ReadonlyArray<LocalSetAside>
  planned: ReadonlyArray<LocalPlanned>
  walletName: (id: string | null) => string
  rates: RatesMap
}): HistoryLine[] {
  const { kind, id, currency, rates } = args
  const mine = <T extends { goalId: string | null; billId?: string | null }>(
    row: T,
  ) => (kind === 'goal' ? row.goalId === id : row.billId === id)
  const inOwner = (amount: number, from: CurrencyCode) =>
    convertMinor(amount, from, currency, rates)
  const lines: HistoryLine[] = []

  for (const a of args.setAsides) {
    if (a.deleted !== 0 || !mine(a)) continue
    const where =
      a.source === 'outside'
        ? (a.externalLabel ?? 'Outside your wallets')
        : args.walletName(a.walletId)
    const amount = money(inOwner(a.amount, a.currency), currency)
    lines.push({
      key: `a:${a.id}`,
      date: a.date,
      label: a.movedByTransferId ? 'Moved in' : 'Set aside',
      sub: where,
      amount: `+${amount}`,
      tone: 'in',
    })
    if (a.releasedAt && !a.releasedById && !a.movedByTransferId)
      lines.push({
        key: `f:${a.id}`,
        date: a.releasedAt.slice(0, 10),
        label: 'Freed',
        sub: where,
        amount,
        tone: 'none',
      })
  }
  for (const t of args.txns) {
    if (t.deleted !== 0 || t.type !== 'spend' || !mine(t)) continue
    lines.push({
      key: `t:${t.id}`,
      date: t.date,
      label: kind === 'bill' ? 'Paid' : 'Used',
      sub: args.walletName(t.walletId),
      amount: `−${money(inOwner(t.amount, t.currency), currency)}`,
      tone: 'out',
    })
  }
  for (const p of args.planned) {
    if (
      p.deleted !== 0 ||
      p.status !== 'skipped' ||
      p.role !== 'payment' ||
      !mine(p)
    )
      continue
    lines.push({
      key: `p:${p.id}`,
      date: p.date,
      label: 'Skipped',
      sub: 'Not paid',
      amount: '—',
      tone: 'none',
    })
  }
  return lines
    .sort((x, y) => y.date.localeCompare(x.date) || x.key.localeCompare(y.key))
    .slice(0, HISTORY_SHOWN)
}
