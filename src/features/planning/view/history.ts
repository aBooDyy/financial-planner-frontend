/**
 * A bill's or goal's history for its detail panel: set-asides made (and taken back, or moved to
 * another wallet), payments or spending, and skipped occurrences — latest first. Money a transfer
 * moved is told once: the row it left reads "Moved to <wallet>", and the row it landed in adds
 * nothing of its own until it is used, freed or moved on. Pure.
 */
import type { LocalPlanned, LocalSetAside, LocalTransaction } from '#/db/types'
import { autoSettlementId } from '#/features/planned/data/autoConfirm'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { money } from './format'
import { setAsideMoves } from './setAsideMoves'

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
  /** A transaction's category as shown on its line ("Visa fees"); null leaves it out. */
  categoryName: (id: string | null) => string | null
  rates: RatesMap
}): HistoryLine[] {
  const { kind, id, currency, rates } = args
  const mine = <T extends { goalId: string | null; billId?: string | null }>(
    row: T,
  ) => (kind === 'goal' ? row.goalId === id : row.billId === id)
  const inOwner = (amount: number, from: CurrencyCode) =>
    convertMinor(amount, from, currency, rates)
  const lines: HistoryLine[] = []

  const owned = args.setAsides.filter((a) => a.deleted === 0 && mine(a))
  const moves = setAsideMoves(owned)
  for (const a of owned) {
    const where =
      a.source === 'outside'
        ? (a.externalLabel ?? 'Outside your wallets')
        : args.walletName(a.walletId)
    const amount = money(inOwner(a.amount, a.currency), currency)
    const movedTo = moves.movedTo.get(a.id)
    if (!moves.carried.has(a.id))
      lines.push({
        key: `a:${a.id}`,
        date: a.date,
        label:
          a.movedByTransferId && movedTo === undefined
            ? 'Moved in'
            : 'Set aside',
        sub: where,
        amount: `+${amount}`,
        tone: 'in',
      })
    if (!a.releasedAt || a.releasedById) continue
    lines.push({
      key: `${movedTo === undefined ? 'f' : 'm'}:${a.id}`,
      date: a.releasedAt.slice(0, 10),
      label:
        movedTo === undefined
          ? 'Taken back'
          : movedTo
            ? `Moved to ${args.walletName(movedTo)}`
            : 'Moved',
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
      label:
        kind === 'goal'
          ? 'Used'
          : t.plannedId && t.id === autoSettlementId(t.plannedId)
            ? 'Paid · auto-pay'
            : 'Paid',
      sub: [
        kind === 'goal' ? args.categoryName(t.categoryId) : null,
        args.walletName(t.walletId),
      ]
        .filter(Boolean)
        .join(' · '),
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
