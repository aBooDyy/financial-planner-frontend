import { useMemo, useSyncExternalStore } from 'react'
import { sharedLiveQuery } from '#/db/sharedLiveQuery'
import { readWalletTotals } from '#/features/transactions/data/ledgerReads'
import { walletDeltasFromTotals } from '#/features/transactions/data/ledgerTotals'
import type { RatesMap } from '#/lib/config/rates'

type WalletTotals = Awaited<ReturnType<typeof readWalletTotals>>
type Deltas = Record<string, number>

const walletTotals = sharedLiveQuery(readWalletTotals)

// The last conversion, so every consumer with the same rates gets the same object.
let last: { read: WalletTotals; rates: RatesMap; deltas: Deltas } | null = null
function deltasOf(read: WalletTotals, rates: RatesMap): Deltas {
  if (last?.read !== read || last.rates !== rates)
    last = {
      read,
      rates,
      deltas: walletDeltasFromTotals(read.nodes, read.totals, rates),
    }
  return last.deltas
}

/**
 * Each wallet's signed delta over the whole ledger, from the running totals — one live read
 * however many hooks ask, converted with `rates`. `undefined` until the read lands.
 */
export function useWalletDeltas(rates: RatesMap): Deltas | undefined {
  const read = useSyncExternalStore(
    walletTotals.subscribe,
    walletTotals.snapshot,
  )
  return useMemo(
    () => (read ? deltasOf(read, rates) : undefined),
    [read, rates],
  )
}
