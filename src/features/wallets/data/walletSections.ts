import type { WalletGroupOption } from './selectors'

/** A run of picker rows under the group that holds them; `null` = wallets outside any group. */
export type WalletSection<T> = { label: string | null; items: T[] }

/**
 * Lays a picker's own rows out under their groups, in the Wallets tree's order. Only rows
 * passed in are kept, so a filtered list keeps its filter; a row the tree doesn't place goes
 * last, unlabelled.
 */
export function sectionByGroup<T extends { id: string }>(
  groups: ReadonlyArray<WalletGroupOption>,
  items: ReadonlyArray<T>,
): WalletSection<T>[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const sections: WalletSection<T>[] = []
  for (const group of groups) {
    const rows = group.wallets.flatMap((w) => {
      const item = byId.get(w.id)
      if (!item) return []
      byId.delete(w.id)
      return [item]
    })
    if (rows.length > 0) sections.push({ label: group.label, items: rows })
  }
  if (byId.size > 0) sections.push({ label: null, items: [...byId.values()] })
  return sections
}

/** The tree's own groups as sections, for a picker that lists every wallet. */
export const walletSections = (
  groups: ReadonlyArray<WalletGroupOption>,
): WalletSection<WalletGroupOption['wallets'][number]>[] =>
  groups.map((g) => ({ label: g.label, items: g.wallets }))
