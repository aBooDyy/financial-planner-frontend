import type {
  LocalEmailConnection,
  LocalPendingImport,
  LocalTransaction,
} from '#/db/types'
import type {
  EmailConnection,
  PendingImport,
} from '#/features/email-sync/api/types'
import type { Transaction } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'

export const connectionToLocal = (
  c: EmailConnection,
): LocalEmailConnection => ({ ...c })

export const importToLocal = (i: PendingImport): LocalPendingImport => ({
  ...i,
  currency: (i.currency as CurrencyCode | null) ?? null,
})

/** A confirmed import's promoted ledger entry, as a clean (already-synced) local row. */
export const transactionToLocal = (t: Transaction): LocalTransaction => ({
  ...t,
  dirty: 0,
  deleted: 0,
})
