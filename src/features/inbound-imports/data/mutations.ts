import { db } from '#/db/db'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { InboundImport } from '#/features/inbound-imports/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { toWireTxType } from '#/features/transactions/api/types'
import { transactionToLocal } from './mappers'

/**
 * Values the user may supply at confirm time. They override whatever was parsed, and are
 * required when nothing was — the user reads them off the stored body.
 */
type ConfirmOverrides = {
  amount?: number
  currency?: string
  date?: string
  merchant?: string
  note?: string
}

export async function confirmImport(
  item: InboundImport,
  input: {
    walletId: string
    category: string
    subcategory: string | null
    type: TxType
  } & ConfirmOverrides,
): Promise<void> {
  const { walletId, category, subcategory, type, ...overrides } = input
  const { transaction } = await inboundImportsApi.confirmImport(item.id, {
    wallet_id: walletId,
    category,
    subcategory,
    type: toWireTxType(type),
    ...overrides,
  })
  await db.transaction('rw', db.inboundImports, db.transactions, async () => {
    await db.inboundImports.delete(item.id)
    // Reflect the promoted entry in the local ledger immediately (clean, already-synced).
    await db.transactions.put(transactionToLocal(transaction))
  })
}

export async function dismissImport(item: InboundImport): Promise<void> {
  await inboundImportsApi.dismissImport(item.id)
  await db.inboundImports.delete(item.id)
}
