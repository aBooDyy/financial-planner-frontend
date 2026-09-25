/**
 * What an import writes, counted the way a person counts it: a transfer is one thing even
 * though it is two rows on disk, so it is never folded into the transactions.
 */
export type ImportPlan = { transactions: number; transfers: number }

const NUMBER = new Intl.NumberFormat()

const counted = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${NUMBER.format(count)} ${many}`

/** "12 transactions · 3 transfers"; the transfers only when there are some. */
export const planLabel = (plan: ImportPlan): string => {
  const transactions = counted(plan.transactions, 'transaction', 'transactions')
  return plan.transfers === 0
    ? transactions
    : `${transactions} · ${counted(plan.transfers, 'transfer', 'transfers')}`
}

/** "12 transactions and 3 transfers", for a sentence. */
export const planPhrase = (plan: ImportPlan): string => {
  const transactions = counted(plan.transactions, 'transaction', 'transactions')
  return plan.transfers === 0
    ? transactions
    : `${transactions} and ${counted(plan.transfers, 'transfer', 'transfers')}`
}

/** A batch recorded before transfers could be imported holds none. */
export const batchPlan = (batch: {
  importedCount: number
  transferCount?: number
}): ImportPlan => ({
  transactions: batch.importedCount,
  transfers: batch.transferCount ?? 0,
})
