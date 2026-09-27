import { shortDate } from '#/features/planned'
import type { PlannedRowView } from '#/features/planned'
import { addDaysISO } from '#/features/planned/data/dates'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { TransferWallet } from './transferDialog'

export const COMING_UP_DAYS = 30
export const COMING_UP_ITEMS_SHOWN = 3

export type ComingUpItem = {
  id: string
  name: string
  whenStr: string
  direction: 'in' | 'out'
  /** Signed, in the item's own currency: "−SR 3,000.00". */
  amountStr: string
}

/**
 * `short` — the wallet drops below zero before the window ends; `reserved` — it stays above
 * zero but dips into money set aside for goals.
 */
export type ComingUpAlert = { kind: 'short' | 'reserved'; text: string }

export type ComingUpWallet = {
  id: string
  name: string
  color: string
  icon: TransferWallet['icon']
  nowStr: string
  afterStr: string
  alert: ComingUpAlert | null
  items: ComingUpItem[]
  moreCount: number
}

export type ComingUpView = {
  wallets: ComingUpWallet[]
  /** Open payments/income in the window that name no wallet, so no balance can price them. */
  unassignedCount: number
  isEmpty: boolean
}

export type ComingUpInput = {
  /** Open planned rows (due and upcoming), as the Planned tab builds them. */
  rows: ReadonlyArray<PlannedRowView>
  wallets: ReadonlyArray<TransferWallet>
  /** What each wallet holds for goals, in its own currency. */
  reserved: Readonly<Record<string, number>>
  rates: RatesMap
  today: string
}

type Step = { row: PlannedRowView; delta: number }

/** Set-asides earmark money without moving it, so only payments and income change a balance. */
const movesMoney = (r: PlannedRowView): boolean =>
  r.item.role === 'payment' || r.item.role === 'income'

// An overdue item is owed already, so a shortfall it causes is happening now.
const whenOf = (date: string, today: string): string =>
  date <= today ? 'now' : `on ${shortDate(date)}`

function alertFor(
  wallet: TransferWallet,
  steps: Step[],
  reserved: number,
  today: string,
): ComingUpAlert | null {
  let balance = wallet.balance
  let dipsIntoReserved: string | null = null
  for (const { row, delta } of steps) {
    balance += delta
    const when = whenOf(row.item.date, today)
    if (balance < 0) return { kind: 'short', text: `Goes below zero ${when}` }
    if (dipsIntoReserved === null && reserved > 0 && balance < reserved)
      dipsIntoReserved = when
  }
  return dipsIntoReserved
    ? { kind: 'reserved', text: `Dips into goal money ${dipsIntoReserved}` }
    : null
}

const signed = (r: PlannedRowView): string =>
  `${r.direction === 'in' ? '+' : '−'}${formatMoney(r.remainder, r.currency)}`

function walletView(
  wallet: TransferWallet,
  steps: Step[],
  reserved: number,
  today: string,
): ComingUpWallet {
  const after = steps.reduce((sum, s) => sum + s.delta, wallet.balance)
  return {
    id: wallet.id,
    name: wallet.name,
    color: wallet.color,
    icon: wallet.icon,
    nowStr: formatMoney(wallet.balance, wallet.currency),
    afterStr: formatMoney(after, wallet.currency),
    alert: alertFor(wallet, steps, reserved, today),
    items: steps.slice(0, COMING_UP_ITEMS_SHOWN).map(({ row }) => ({
      id: row.id,
      name: row.name,
      whenStr: row.relStr,
      direction: row.direction,
      amountStr: signed(row),
    })),
    moreCount: Math.max(0, steps.length - COMING_UP_ITEMS_SHOWN),
  }
}

const ALERT_RANK = { short: 0, reserved: 1 } as const

/**
 * The next 30 days of bills and income, per wallet: today's balance, what it becomes once
 * everything lands, and whether it runs short on the way. Anything already due counts as
 * landing now — it hasn't been confirmed, but it's owed.
 */
export function buildComingUp(input: ComingUpInput): ComingUpView {
  const until = addDaysISO(input.today, COMING_UP_DAYS)
  const inWindow = input.rows.filter(
    (r) => movesMoney(r) && r.remainder > 0 && r.item.date <= until,
  )
  const byWallet = new Map(input.wallets.map((w) => [w.id, w]))

  const planned = new Map<string, { wallet: TransferWallet; steps: Step[] }>()
  let unassignedCount = 0
  for (const row of inWindow) {
    const wallet = row.walletId ? byWallet.get(row.walletId) : undefined
    if (!wallet) {
      unassignedCount += 1
      continue
    }
    const amount = convertMinor(
      row.remainder,
      row.currency,
      wallet.currency,
      input.rates,
    )
    const entry = planned.get(wallet.id) ?? { wallet, steps: [] }
    entry.steps.push({ row, delta: row.direction === 'in' ? amount : -amount })
    planned.set(wallet.id, entry)
  }

  // Wallets keep the order of their first item; a stable sort then lifts the ones in trouble.
  const rank = (w: ComingUpWallet) => (w.alert ? ALERT_RANK[w.alert.kind] : 2)
  const wallets = [...planned.values()]
    .map(({ wallet, steps }) => {
      steps.sort((a, b) => a.row.item.date.localeCompare(b.row.item.date))
      return walletView(
        wallet,
        steps,
        input.reserved[wallet.id] ?? 0,
        input.today,
      )
    })
    .sort((a, b) => rank(a) - rank(b))

  return {
    wallets,
    unassignedCount,
    isEmpty: wallets.length === 0 && unassignedCount === 0,
  }
}
