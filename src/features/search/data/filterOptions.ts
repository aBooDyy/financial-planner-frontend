import type { LocalBalanceNode } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { treeWallets } from './walletTree'

export type CategoryOption = {
  id: string
  name: string
  color: string
  iconId: string
  subs: { id: string; name: string }[]
}

export type WalletOption = {
  id: string
  name: string
  color: string
  groupName: string | null
}

/** Every root the category filter offers, spending first, each with its children. */
export const categoryOptions = (catalog: CategoryCatalog): CategoryOption[] =>
  [...catalog.byType('spend'), ...catalog.byType('income')].map((root) => ({
    id: root.id,
    name: root.name,
    color: root.color,
    iconId: root.icon,
    subs: root.subs.map((s) => ({ id: s.id, name: s.name })),
  }))

/** The live wallets the account filter offers, in tree order. */
export const walletOptions = (
  nodes: ReadonlyArray<LocalBalanceNode>,
): WalletOption[] =>
  treeWallets(nodes).map(({ wallet, group }) => ({
    id: wallet.id,
    name: wallet.name,
    color: wallet.color,
    groupName: group?.name ?? null,
  }))
