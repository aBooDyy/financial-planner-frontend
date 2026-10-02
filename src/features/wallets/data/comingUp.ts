import type { LocalSetAside } from '#/db/types'
import { shortDate } from '#/features/planned'
import type { PlannedRowView } from '#/features/planned'
import { addDaysISO } from '#/features/planned/data/dates'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
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
 * `short` — the wallet's balance drops below zero before the window ends; `setAside` — it stays
 * above zero but dips into money set aside (its Free to spend goes below zero).
 */
export type ComingUpAlert = { kind: 'short' | 'setAside'; text: string }

export type ComingUpWallet = {
  id: string
  name: string
  color: string
  icon: TransferWallet['icon']
  /** Free to spend now, and once everything in the window has landed. */
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
  /** "No wallet yet: −SR 650.00" — what they come to together, base currency (F9). */
  unassignedStr: string | null
  isEmpty: boolean
}

export type ComingUpInput = {
  /** Open planned rows (due and upcoming), as the Planned tab builds them. */
  rows: ReadonlyArray<PlannedRowView>
  wallets: ReadonlyArray<TransferWallet>
  /** What each wallet holds set aside, in its own currency. */
  setAside: Readonly<Record<string, number>>
  /** The set-aside rows, to know what each payment releases where it is paid from. */
  setAsides: ReadonlyArray<LocalSetAside>
  base: CurrencyCode
  rates: RatesMap
  today: string
}

/** One landing: what it does to the balance, and the set-aside it releases (wallet currency). */
type Step = { row: PlannedRowView; delta: number; release: number }

/** Set-asides earmark money without moving it, so only payments and income change a balance. */
const movesMoney = (r: PlannedRowView): boolean =>
  r.item.role === 'payment' || r.item.role === 'income'

// An overdue item is owed already, so a shortfall it causes is happening now.
const whenOf = (date: string, today: string): string =>
  date <= today ? 'now' : `on ${shortDate(date)}`

/**
 * The first trouble walking the wallet's days in order: its balance going below zero beats its
 * Free to spend going below zero. A payment releases its own set-aside as it lands (F8), so
 * paying a bill that was saved for never reads as dipping into set-aside money.
 */
function alertFor(
  wallet: TransferWallet,
  steps: Step[],
  setAside: number,
  today: string,
): ComingUpAlert | null {
  let balance = wallet.balance
  let held = setAside
  let dips: string | null = null
  for (const { row, delta, release } of steps) {
    balance += delta
    held -= release
    const when = whenOf(row.item.date, today)
    if (balance < 0) return { kind: 'short', text: `Goes below zero ${when}` }
    if (dips === null && balance - held < 0) dips = when
  }
  return dips
    ? { kind: 'setAside', text: `Dips into set-aside money ${dips}` }
    : null
}

const signed = (r: PlannedRowView): string =>
  `${r.direction === 'in' ? '+' : '−'}${formatMoney(r.remainder, r.currency)}`

function walletView(
  wallet: TransferWallet,
  steps: Step[],
  setAside: number,
  today: string,
): ComingUpWallet {
  const now = wallet.balance - setAside
  const after = steps.reduce((sum, s) => sum + s.delta + s.release, now)
  return {
    id: wallet.id,
    name: wallet.name,
    color: wallet.color,
    icon: wallet.icon,
    nowStr: formatMoney(now, wallet.currency),
    afterStr: formatMoney(after, wallet.currency),
    alert: alertFor(wallet, steps, setAside, today),
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

const ALERT_RANK = { short: 0, setAside: 1 } as const

/** What a payment row would release where it is paid: its bill occurrence's or its goal's. */
const ownerKeyOf = (row: PlannedRowView): string | null =>
  row.item.billId
    ? `bill:${row.item.billId}:${row.item.occurrence}`
    : row.item.goalId
      ? `goal:${row.item.goalId}`
      : null

const setAsideKey = (a: LocalSetAside): string =>
  `${a.walletId}|${a.billId ? `bill:${a.billId}:${a.occurrence}` : `goal:${a.goalId}`}`

/** Live wallet set-asides by wallet and owner, in the wallet's currency. */
function heldByOwner(
  setAsides: ReadonlyArray<LocalSetAside>,
  wallets: ReadonlyMap<string, TransferWallet>,
  rates: RatesMap,
): Map<string, number> {
  const held = new Map<string, number>()
  for (const a of setAsides) {
    if (!isLiveSetAside(a) || a.source !== 'wallet' || !a.walletId) continue
    const wallet = wallets.get(a.walletId)
    if (!wallet) continue
    const key = setAsideKey(a)
    held.set(
      key,
      (held.get(key) ?? 0) +
        convertMinor(a.amount, a.currency, wallet.currency, rates),
    )
  }
  return held
}

/**
 * The next 30 days of bills and income, per wallet (03 §9): today's Free to spend, what it
 * becomes once everything lands, and whether it runs short on the way. A payment releases what
 * its own bill occurrence (or goal) holds in that wallet. Anything already due counts as landing
 * now — it hasn't been confirmed, but it's owed.
 */
export function buildComingUp(input: ComingUpInput): ComingUpView {
  const until = addDaysISO(input.today, COMING_UP_DAYS)
  const inWindow = input.rows.filter(
    (r) => movesMoney(r) && r.remainder > 0 && r.item.date <= until,
  )
  const byWallet = new Map(input.wallets.map((w) => [w.id, w]))

  const held = heldByOwner(input.setAsides, byWallet, input.rates)
  const byDate = [...inWindow].sort((a, b) =>
    a.item.date.localeCompare(b.item.date),
  )

  const planned = new Map<string, { wallet: TransferWallet; steps: Step[] }>()
  let unassignedCount = 0
  let unassigned = 0
  for (const row of byDate) {
    const wallet = row.walletId ? byWallet.get(row.walletId) : undefined
    if (!wallet) {
      unassignedCount += 1
      const inBase = convertMinor(
        row.remainder,
        row.currency,
        input.base,
        input.rates,
      )
      unassigned += row.direction === 'in' ? inBase : -inBase
      continue
    }
    const amount = convertMinor(
      row.remainder,
      row.currency,
      wallet.currency,
      input.rates,
    )
    const owner = row.item.role === 'payment' ? ownerKeyOf(row) : null
    const key = owner ? `${wallet.id}|${owner}` : null
    const release = key ? Math.min(amount, held.get(key) ?? 0) : 0
    if (key) held.set(key, (held.get(key) ?? 0) - release)
    const entry = planned.get(wallet.id) ?? { wallet, steps: [] }
    entry.steps.push({
      row,
      delta: row.direction === 'in' ? amount : -amount,
      release,
    })
    planned.set(wallet.id, entry)
  }

  // Wallets keep the order of their first item; a stable sort then lifts the ones in trouble.
  const rank = (w: ComingUpWallet) => (w.alert ? ALERT_RANK[w.alert.kind] : 2)
  const wallets = [...planned.values()]
    .map(({ wallet, steps }) =>
      walletView(wallet, steps, input.setAside[wallet.id] ?? 0, input.today),
    )
    .sort((a, b) => rank(a) - rank(b))

  return {
    wallets,
    unassignedCount,
    unassignedStr:
      unassignedCount > 0
        ? `No wallet yet: ${unassigned < 0 ? '−' : '+'}${formatMoney(Math.abs(unassigned), input.base)}`
        : null,
    isEmpty: wallets.length === 0 && unassignedCount === 0,
  }
}
