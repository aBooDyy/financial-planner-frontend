import { useCallback, useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { scopeSections } from '#/features/transactions/data/selectors'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import {
  entryAccountSections,
  offeredAccountSections,
} from '#/features/transactions/data/txDialog'
import { useWalletDeltas } from '#/features/transactions/hooks/useWalletDeltas'
import { hiddenByArchive } from '#/features/wallets/data/archive'
import { transferWallets } from '#/features/wallets/data/transferDialog'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'

export type PickedAccount = Pick<
  TransferWallet,
  'id' | 'name' | 'color' | 'icon'
> & { archived: boolean }

const NO_DELTAS: Record<string, number> = {}

/**
 * The account tree a wallet picker lists, with live balances. `offered` narrows it to the
 * wallets this picker allows; one the tree leaves out (archived) goes under its own heading.
 */
export function useAccountSections(offered?: ReadonlyArray<{ id: string }>): {
  sections: ScopeSection[]
  amountsLoading: boolean
  /** The wallets and groups have been read, so a wallet not found is really gone. */
  ready: boolean
  accountById: (id: string) => PickedAccount | undefined
} {
  const { inputs, nodes, loading, nodesLoading } = usePlannedData()
  const { base, rates } = inputs
  const deltas = useWalletDeltas(rates)
  const offeredKey = offered?.map((w) => w.id).join(',')

  const sections = useMemo(() => {
    const balances = deltas ?? NO_DELTAS
    const tree = scopeSections({ nodes, base, rates }, balances)
    if (offeredKey === undefined) return entryAccountSections(tree, [])
    const ids = new Set(offeredKey.split(','))
    const hidden = hiddenByArchive(nodes)
    const archived = nodes.filter((n) => ids.has(n.id) && hidden.has(n.id))
    return entryAccountSections(
      offeredAccountSections(tree, ids),
      transferWallets(archived, balances, base),
    )
  }, [nodes, base, rates, deltas, offeredKey])

  const accounts = useMemo(() => {
    const hidden = hiddenByArchive(nodes)
    return new Map(
      nodes
        .filter((n) => n.kind === 'wallet')
        .map((n): [string, PickedAccount] => [
          n.id,
          {
            id: n.id,
            name: n.name,
            color: n.color,
            icon: iconIdOr(n.icon, WALLET_ICON),
            archived: hidden.has(n.id),
          },
        ]),
    )
  }, [nodes])
  const accountById = useCallback((id: string) => accounts.get(id), [accounts])

  return {
    sections,
    amountsLoading: loading || deltas === undefined,
    ready: !nodesLoading,
    accountById,
  }
}
