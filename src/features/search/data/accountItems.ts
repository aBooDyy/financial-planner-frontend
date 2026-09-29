import type { LocalBalanceNode } from '#/db/types'
import { formatMoney } from '#/lib/currency'
import { nodeIcon } from './items'
import type { ItemContext, SearchItem } from './items'
import { searchText } from './match'
import { treeWallets } from './walletTree'

/** Every live wallet in tree order, valued at its live balance in its own currency. */
export function accountItems(
  nodes: ReadonlyArray<LocalBalanceNode>,
  balances: Readonly<Record<string, number>>,
  ctx: ItemContext,
): SearchItem[] {
  return treeWallets(nodes).map(({ wallet, group }) => ({
    row: () => ({
      key: `account:${wallet.id}`,
      target: { kind: 'account', id: wallet.id },
      title: wallet.name,
      sub: `${group?.name ?? 'Account'} · switch to this account`,
      valueStr: formatMoney(
        balances[wallet.id] ?? 0,
        wallet.currency ?? ctx.base,
      ),
      positive: false,
      color: wallet.color,
      iconId: nodeIcon(wallet),
    }),
    text: searchText([wallet.name, group?.name]),
    flow: null,
    date: null,
    categoryId: null,
    rootId: null,
    wholeCategory: false,
    walletIds: [wallet.id],
    baseMajor: null,
  }))
}
