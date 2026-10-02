/**
 * The three numbers Wallets shows at every level (03 §2, §8): **Balance** (what the bank says),
 * **Set aside** (live set-asides held in the wallet) and **Free to spend** (the difference,
 * negative when over-committed). Pure.
 *
 * The invariants hold by construction: a wallet's Set aside is the sum of its lines; a group's
 * and the header's figures are the sums of their active wallets' figures in base currency
 * (each wallet converted once, Free derived from the converted Balance and Set aside, so the
 * sums agree to the minor unit). Archived wallets — and wallets inside an archived group — are
 * left out of groups and the header.
 */
import type {
  LocalBalanceNode,
  LocalBill,
  LocalGoal,
  LocalSetAside,
} from '#/db/types'
import { walletSetAsides } from '#/features/setAsides/data/totals'
import type { WalletSetAsideLine } from '#/features/setAsides/data/totals'
import { activeNodes } from '#/features/wallets/data/archive'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

export type MoneyFigures = {
  balance: number
  setAside: number
  /** `balance − setAside`; negative = over-committed. */
  free: number
}

export type WalletFigures = MoneyFigures & {
  walletId: string
  currency: CurrencyCode
  /** One line per bill or goal it holds money for, largest first. */
  lines: WalletSetAsideLine[]
  /** How far Set aside exceeds Balance; 0 when it doesn't. */
  overBy: number
  /** The same three figures in base currency — what groups and the header add up. */
  inBase: MoneyFigures
}

export type BalanceFigures = {
  base: CurrencyCode
  /** Every live wallet, archived ones included (their own row still reads true). */
  wallets: Record<string, WalletFigures>
  /** Every active group, base currency. */
  groups: Record<string, MoneyFigures>
  /** Σ over active wallets, base currency. */
  header: MoneyFigures
}

export type BalanceInput = {
  nodes: ReadonlyArray<LocalBalanceNode>
  /** Signed ledger deltas per wallet, in the wallet's currency (added to its opening amount). */
  walletDeltas: Readonly<Record<string, number>>
  setAsides: ReadonlyArray<LocalSetAside>
  goals: ReadonlyArray<Pick<LocalGoal, 'id' | 'name' | 'color'>>
  bills: ReadonlyArray<Pick<LocalBill, 'id' | 'name' | 'color'>>
  base: CurrencyCode
  rates: RatesMap
}

const ZERO: MoneyFigures = { balance: 0, setAside: 0, free: 0 }

const add = (a: MoneyFigures, b: MoneyFigures): MoneyFigures => ({
  balance: a.balance + b.balance,
  setAside: a.setAside + b.setAside,
  free: a.free + b.free,
})

export function balanceFigures(input: BalanceInput): BalanceFigures {
  const { base, rates } = input
  const live = input.nodes.filter((n) => n.deleted === 0)
  const lines = walletSetAsides(
    input.setAsides,
    input.goals,
    input.bills,
    live,
    rates,
  )

  const wallets: Record<string, WalletFigures> = {}
  for (const n of live) {
    if (n.kind !== 'wallet') continue
    const currency = n.currency ?? base
    const balance = (n.amount ?? 0) + (input.walletDeltas[n.id] ?? 0)
    const held = lines[n.id] ?? []
    const setAside = held.reduce((sum, l) => sum + l.amount, 0)
    const balanceBase = convertMinor(balance, currency, base, rates)
    const setAsideBase = convertMinor(setAside, currency, base, rates)
    wallets[n.id] = {
      walletId: n.id,
      currency,
      balance,
      setAside,
      free: balance - setAside,
      lines: held,
      overBy: Math.max(0, setAside - balance),
      inBase: {
        balance: balanceBase,
        setAside: setAsideBase,
        free: balanceBase - setAsideBase,
      },
    }
  }

  const active = activeNodes(live)
  const children = new Map<string | null, LocalBalanceNode[]>()
  for (const n of active) {
    const list = children.get(n.parentId) ?? []
    list.push(n)
    children.set(n.parentId, list)
  }
  const groups: Record<string, MoneyFigures> = {}
  const total = (node: LocalBalanceNode): MoneyFigures => {
    if (node.kind === 'wallet') return wallets[node.id].inBase
    const sum = (children.get(node.id) ?? []).reduce(
      (acc, child) => add(acc, total(child)),
      ZERO,
    )
    groups[node.id] = sum
    return sum
  }
  const header = (children.get(null) ?? []).reduce(
    (acc, root) => add(acc, total(root)),
    ZERO,
  )
  return { base, wallets, groups, header }
}
