import { startOfToday } from '#/features/goals/data/planning'
import { usePlanned } from '#/features/planned'
import { isoOf } from '#/features/planned/data/dates'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { WalletSetAsideLine } from '#/features/setAsides/data/totals'
import { buildComingUp } from '#/features/wallets/data/comingUp'
import type { ComingUpView } from '#/features/wallets/data/comingUp'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'

type Input = {
  wallets: TransferWallet[]
  setAsideLines: Readonly<Record<string, WalletSetAsideLine[]>>
  base: CurrencyCode
  rates: RatesMap
  /** The wallets' balances are not known yet. */
  balancesLoading: boolean
}

/** The Wallets rail's "Coming up": `null` until both the balances and the planned rows land. */
export function useComingUp({
  wallets,
  setAsideLines,
  base,
  rates,
  balancesLoading,
}: Input): ComingUpView | null {
  const planned = usePlanned()
  const { inputs } = usePlannedData()
  if (balancesLoading || planned.loading) return null

  const setAside: Record<string, number> = {}
  for (const [walletId, lines] of Object.entries(setAsideLines))
    setAside[walletId] = lines.reduce((sum, l) => sum + l.amount, 0)

  return buildComingUp({
    rows: [...planned.due, ...planned.next, ...planned.later],
    wallets,
    setAside,
    setAsides: inputs.setAsides,
    base,
    rates,
    today: isoOf(startOfToday()),
  })
}
