import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'

/**
 * A merchant's display name by id. `fallback` covers the moment before the reactive read
 * catches up with a merchant created a moment ago.
 */
export function useMerchantName(id: string | null, fallback: string): string {
  const merchant = useLiveQuery(
    () => (id ? db.merchants.get(id) : undefined),
    [id],
  )
  if (!id) return ''
  return merchant && merchant.deleted === 0 ? merchant.displayName : fallback
}
