import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { walletGroupOptions } from '#/features/wallets/data/selectors'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'

/** The Wallets tree as picker groups, for a picker that is handed only its wallets. */
export function useWalletGroups(): WalletGroupOption[] {
  const nodes = useLiveQuery(() => db.balanceNodes.toArray())
  return useMemo(() => walletGroupOptions(nodes ?? []), [nodes])
}
