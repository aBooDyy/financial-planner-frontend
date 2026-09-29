import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import { useLedgerCounts } from '#/features/transactions/hooks/useLedgerCounts'

export type MerchantView = LocalMerchant & {
  aliases: LocalMerchantAlias[]
  txCount: number
}

const live = <T extends { deleted: 0 | 1 }>(rows: T[] | undefined): T[] =>
  (rows ?? []).filter((r) => r.deleted === 0)

/** The synced merchant + alias cache the local matcher runs against. */
export function useMerchantIndex(): MerchantIndex {
  const merchants = useLiveQuery(() => db.merchants.toArray())
  const aliases = useLiveQuery(() => db.merchantAliases.toArray())
  return { merchants: live(merchants), aliases: live(aliases) }
}

/**
 * Reactive read of the merchant list, most-seen first — the order that puts the noisy rows a
 * bulk import created in front of the user, where they can be merged away.
 */
export function useMerchants(): {
  loading: boolean
  merchants: MerchantView[]
} {
  const merchantRows = useLiveQuery(() => db.merchants.toArray())
  const aliasRows = useLiveQuery(() => db.merchantAliases.toArray())
  const counts = useLedgerCounts('merchant')

  const loading = merchantRows === undefined || aliasRows === undefined

  const aliasesByMerchant = new Map<string, LocalMerchantAlias[]>()
  for (const alias of live(aliasRows)) {
    const list = aliasesByMerchant.get(alias.merchantId)
    if (list) list.push(alias)
    else aliasesByMerchant.set(alias.merchantId, [alias])
  }

  const merchants = live(merchantRows)
    .map((m) => ({
      ...m,
      aliases: aliasesByMerchant.get(m.id) ?? [],
      txCount: counts.get(m.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.timesSeen - a.timesSeen ||
        b.txCount - a.txCount ||
        a.displayName.localeCompare(b.displayName),
    )

  return { loading, merchants }
}
