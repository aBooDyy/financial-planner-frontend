/**
 * Moving a set-aside's label to another wallet by hand: no real money moves, and what is owed
 * doesn't change, so the stored plan is left alone. The owner stays the same, so the planned link
 * does too.
 */
import { db } from '#/db/db'
import type { LocalBalanceNode, LocalSetAside } from '#/db/types'
import type { PlanOwner } from '#/features/planned/data/owners'
import { currentRates } from '#/features/planned/data/rows'
import type { RebalanceMove } from '#/features/planning/view/rebalance'
import { moveWithoutTransfer } from '#/features/setAsides/data/batches'
import type { SetAsidePart } from '#/features/setAsides/data/batches'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { activeNodes } from '#/features/wallets/data/archive'
import type { RatesMap } from '#/lib/config/rates'
import { convertMinor } from '#/lib/currency'
import { MoneyActionError } from './errors'

async function activeWallet(id: string): Promise<LocalBalanceNode> {
  const wallet = activeNodes(await db.balanceNodes.toArray()).find(
    (n) => n.id === id && n.kind === 'wallet',
  )
  if (!wallet) throw new MoneyActionError('no_wallet')
  return wallet
}

const isPartAmount = (amount: number) => Number.isInteger(amount) && amount > 0

/** Money too small to exist in the wallet's currency, or with no rate to get there by. */
function refuseLandingAsNothing(
  amount: number,
  row: Pick<LocalSetAside, 'currency'>,
  wallet: LocalBalanceNode,
  rates: RatesMap,
): void {
  const into = wallet.currency ?? row.currency
  if (convertMinor(amount, row.currency, into, rates) <= 0)
    throw new MoneyActionError('bad_amount')
}

/** Moves one row's label to another wallet, whole or part. `amount` in the row's currency. */
export async function moveSetAsideTo(
  id: string,
  toWalletId: string,
  amount?: number,
): Promise<void> {
  const row = await db.setAsides.get(id)
  if (!row || !isLiveSetAside(row)) throw new MoneyActionError('not_found')
  const wallet = await activeWallet(toWalletId)
  if (row.walletId === toWalletId) throw new MoneyActionError('no_wallet')
  const moved = amount ?? row.amount
  if (!isPartAmount(moved) || moved > row.amount)
    throw new MoneyActionError('bad_amount')
  refuseLandingAsNothing(moved, row, wallet, await currentRates())
  await moveWithoutTransfer([
    {
      id,
      ...(moved < row.amount ? { amount: moved } : {}),
      to: { walletId: toWalletId },
    },
  ])
}

async function currencyOfOwner(owner: PlanOwner) {
  const item =
    owner.kind === 'goal'
      ? await db.goals.get(owner.id)
      : await db.bills.get(owner.id)
  if (!item || item.deleted !== 0) throw new MoneyActionError('not_found')
  return item.currency
}

/**
 * The rows that make up `amount` (owner's currency), in order, the last one cut to what is left.
 * Compared in the owner's currency, so the whole of what is held takes every row whole.
 */
function partsOfHeld(
  rows: ReadonlyArray<LocalSetAside>,
  amount: number,
  inOwner: (row: LocalSetAside) => number,
  inRow: (left: number, row: LocalSetAside) => number,
): SetAsidePart[] {
  const parts: SetAsidePart[] = []
  let left = amount
  for (const row of rows) {
    if (left <= 0) break
    const whole = inOwner(row)
    const take = whole <= left ? row.amount : inRow(left, row)
    if (take <= 0) break
    parts.push(
      take >= row.amount ? { id: row.id } : { id: row.id, amount: take },
    )
    left -= whole <= left ? whole : left
  }
  return parts
}

/** Moves what `owner` holds in one wallet to another, oldest rows first; `amount` in the owner's currency, default all. */
export async function moveHeldTo(
  owner: PlanOwner,
  fromWalletId: string,
  toWalletId: string,
  amount?: number,
): Promise<void> {
  const wallet = await activeWallet(toWalletId)
  if (fromWalletId === toWalletId) throw new MoneyActionError('no_wallet')
  const currency = await currencyOfOwner(owner)
  const rates = await currentRates()
  const rows = (
    await db.setAsides.where('walletId').equals(fromWalletId).toArray()
  )
    .filter(
      (a) =>
        isLiveSetAside(a) &&
        a.source === 'wallet' &&
        (owner.kind === 'goal' ? a.goalId : a.billId) === owner.id,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    )
  const inOwner = (row: LocalSetAside) =>
    convertMinor(row.amount, row.currency, currency, rates)
  const held = rows.reduce((sum, row) => sum + inOwner(row), 0)
  // A figure read through another conversion can land a minor unit per row past what is held.
  if (
    amount !== undefined &&
    (!isPartAmount(amount) || amount > held + rows.length)
  )
    throw new MoneyActionError('bad_amount')
  const parts = partsOfHeld(rows, amount ?? held, inOwner, (left, row) =>
    convertMinor(left, currency, row.currency, rates),
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  for (const part of parts) {
    const row = byId.get(part.id) as LocalSetAside
    refuseLandingAsNothing(part.amount ?? row.amount, row, wallet, rates)
  }
  await moveWithoutTransfer(
    parts.map((part) => ({ ...part, to: { walletId: toWalletId } })),
  )
}

/** Every move is checked before any is written, so a plan gone stale changes nothing. */
async function refuseStalePlan(
  moves: ReadonlyArray<RebalanceMove>,
  rows: ReadonlyMap<string, LocalSetAside>,
): Promise<void> {
  const rates = await currentRates()
  const taken = new Map<string, number>()
  for (const move of moves) {
    const row = rows.get(move.setAsideId)
    if (!row || !isLiveSetAside(row)) throw new MoneyActionError('not_found')
    const wallet = await activeWallet(move.toWalletId)
    if (row.walletId === move.toWalletId)
      throw new MoneyActionError('no_wallet')
    const total = (taken.get(row.id) ?? 0) + move.amount
    if (
      !isPartAmount(move.amount) ||
      move.currency !== row.currency ||
      total > row.amount
    )
      throw new MoneyActionError('bad_amount')
    refuseLandingAsNothing(move.amount, row, wallet, rates)
    taken.set(row.id, total)
  }
}

/** A row's amounts per wallet, keeping the order the wallets first appear in. */
function byTargetWallet(
  moves: ReadonlyArray<RebalanceMove>,
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const move of moves) {
    const wallet = out.get(move.toWalletId) ?? new Map<string, number>()
    wallet.set(
      move.setAsideId,
      (wallet.get(move.setAsideId) ?? 0) + move.amount,
    )
    out.set(move.toWalletId, wallet)
  }
  return out
}

/**
 * Applies a plan's moves. Each target wallet is its own batch: a batch carries one id, and that id
 * is what tells which wallet the money went to. So a row split across wallets moves its remainder
 * in the next batch; each batch is all-or-nothing on its own.
 */
export async function applyRebalance(
  moves: ReadonlyArray<RebalanceMove>,
): Promise<void> {
  if (moves.length === 0) return
  const found = await db.setAsides.bulkGet(moves.map((m) => m.setAsideId))
  const rows = new Map(
    found.flatMap((row): [string, LocalSetAside][] =>
      row ? [[row.id, row]] : [],
    ),
  )
  await refuseStalePlan(moves, rows)
  const current = new Map([...rows.values()].map((r) => [r.id, r]))
  for (const [walletId, amounts] of byTargetWallet(moves)) {
    const entries = [...amounts]
    const { remainders } = await moveWithoutTransfer(
      entries.map(([id, amount]) => {
        const row = current.get(id) as LocalSetAside
        return {
          id: row.id,
          ...(amount < row.amount ? { amount } : {}),
          to: { walletId },
        }
      }),
    )
    for (const [id, amount] of entries) {
      const row = current.get(id) as LocalSetAside
      const remainder = remainders.get(row.id)
      if (remainder)
        current.set(id, { ...row, id: remainder, amount: row.amount - amount })
    }
  }
}
