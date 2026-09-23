import type { LocalInboundImport, LocalTransaction } from '#/db/types'
import type { InboundImport } from '#/features/inbound-imports/api/types'
import type { Transaction } from '#/features/transactions/api/types'

export const importToLocal = (i: InboundImport): LocalInboundImport => ({
  ...i,
})

/** A confirmed import's promoted ledger entry, as a clean (already-synced) local row. */
export const transactionToLocal = (t: Transaction): LocalTransaction => ({
  ...t,
  merchantId: t.merchantId ?? null,
  dirty: 0,
  deleted: 0,
})
