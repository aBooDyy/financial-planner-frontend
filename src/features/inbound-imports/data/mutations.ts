import { db } from '#/db/db'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { InboundImport } from '#/features/inbound-imports/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { toWireTxType } from '#/features/transactions/api/types'
import { saveTransactionEdit } from '#/features/transactions/data/billPayments'
import type { LeftoverPrompt } from '#/features/transactions/data/billPayments'
import type { CountsLink } from '#/features/transactions/data/countsLink'
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
    /** The leaf filed under: a subcategory's id, else its root's. */
    categoryId: string
    type: TxType
  } & ConfirmOverrides,
): Promise<string> {
  const { walletId, categoryId, type, ...overrides } = input
  const { transaction } = await inboundImportsApi.confirmImport(item.id, {
    wallet_id: walletId,
    category_id: categoryId,
    type: toWireTxType(type),
    ...overrides,
  })
  await db.transaction('rw', db.inboundImports, db.transactions, async () => {
    await db.inboundImports.delete(item.id)
    // Reflect the promoted entry in the local ledger immediately (clean, already-synced).
    await db.transactions.put(transactionToLocal(transaction))
  })
  return transaction.id
}

const linksNothing = (link: CountsLink) =>
  !link.plannedId && !link.goalId && !link.billId

/**
 * Points a just-confirmed entry at the bill, goal or payday it counts toward. It goes through
 * the dialog's edit path, so a bill payment releases its set-asides and moves `nextDue` on.
 */
export async function linkConfirmed(
  transactionId: string,
  link: CountsLink,
): Promise<LeftoverPrompt | null> {
  const tx = await db.transactions.get(transactionId)
  if (!tx?.categoryId || linksNothing(link)) return null
  if (tx.type !== 'spend' && tx.type !== 'income') return null
  return saveTransactionEdit(transactionId, {
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    categoryId: tx.categoryId,
    walletId: tx.walletId,
    date: tx.date,
    note: tx.note,
    ...link,
  })
}

export async function dismissImport(item: InboundImport): Promise<void> {
  await inboundImportsApi.dismissImport(item.id)
  await db.inboundImports.delete(item.id)
}
