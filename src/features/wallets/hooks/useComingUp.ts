import { startOfToday } from '#/features/goals/data/planning'
import { usePlanned } from '#/features/planned'
import { isoOf } from '#/features/planned/data/dates'
import { buildComingUp } from '#/features/wallets/data/comingUp'
import type { ComingUpView } from '#/features/wallets/data/comingUp'
import type { WalletSetAsideLine } from '#/features/setAsides/data/totals'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import type { RatesMap } from '#/lib/config/rates'

type Input = {
  wallets: TransferWallet[]
  reservations: Readonly<Record<string, WalletSetAsideLine[]>>
  rates: RatesMap
  /** The wallets' balances are not known yet. */
  balancesLoading: boolean
}

/** The Wallets rail's "Coming up": `null` until both the balances and the planned rows land. */
export function useComingUp({
  wallets,
  reservations,
  rates,
  balancesLoading,
}: Input): ComingUpView | null {
  const planned = usePlanned()
  if (balancesLoading || planned.loading) return null

  const reserved: Record<string, number> = {}
  for (const [walletId, lines] of Object.entries(reservations))
    reserved[walletId] = lines.reduce((sum, l) => sum + l.amount, 0)

  return buildComingUp({
    rows: [...planned.due, ...planned.next, ...planned.later],
    wallets,
    reserved,
    rates,
    today: isoOf(startOfToday()),
  })
}
