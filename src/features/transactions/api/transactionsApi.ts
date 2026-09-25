import type { ChangesPage, ChangesQuery, ChangesWire } from '#/db/changes'
import { changesPath, toChangesPage } from '#/db/changes'
import { http } from '#/lib/http'
import type {
  Budget,
  BudgetWire,
  BulkCreateTransactionsWire,
  BulkCreateTransfersWire,
  BulkDeleteResult,
  BulkDeleteTransactionsWire,
  BulkTransactionResult,
  BulkTransferResult,
  CreateBudgetWire,
  CreateRecurringWire,
  CreateTransactionWire,
  CreateTransferWire,
  Recurring,
  RecurringWire,
  Transaction,
  TransactionWire,
  Transfer,
  TransferWire,
  UpdateBudgetWire,
  UpdateRecurringWire,
  UpdateTransactionWire,
  UpdateTransferWire,
} from './types'
import {
  toBudget,
  toBulkDeleteResult,
  toBulkResult,
  toBulkTransferResult,
  toRecurring,
  toTransaction,
  toTransfer,
} from './types'

/**
 * Remote calls for the Spending entities (transactions, budgets, recurring schedules). The
 * sync engine owns when these run; UI reads from the local DB, never from here directly.
 */
export const transactionsApi = {
  list: (): Promise<Transaction[]> =>
    http
      .get<TransactionWire[]>('/transactions')
      .then((r) => r.map(toTransaction)),
  /** One page of the delta stream — what the sync engine uses instead of `list`. */
  changes: (query: ChangesQuery): Promise<ChangesPage<Transaction>> =>
    http
      .get<ChangesWire<TransactionWire>>(changesPath('/transactions', query))
      .then((w) => toChangesPage(w, toTransaction)),
  create: (payload: CreateTransactionWire): Promise<Transaction> =>
    http.post<TransactionWire>('/transactions', payload).then(toTransaction),
  /**
   * Record many at once. The request succeeds as a whole while individual entries may not,
   * so the outcome is per item — the caller answers each against its own queue entry.
   */
  bulkCreate: (
    items: ReadonlyArray<CreateTransactionWire>,
  ): Promise<BulkTransactionResult[]> =>
    http
      .post<BulkCreateTransactionsWire>('/transactions/bulk', { items })
      .then((r) => r.results.map(toBulkResult)),
  /**
   * Remove many at once — the delete side of `bulkCreate`, and the same shape: the request
   * succeeds as a whole while each id is answered on its own terms. Undoing an import
   * queues one delete per row, which a round trip each turns into minutes of HTTP.
   */
  bulkDelete: (ids: ReadonlyArray<string>): Promise<BulkDeleteResult[]> =>
    http
      .post<BulkDeleteTransactionsWire>('/transactions/bulk-delete', { ids })
      .then((r) => r.results.map(toBulkDeleteResult)),
  update: (id: string, payload: UpdateTransactionWire): Promise<Transaction> =>
    http
      .patch<TransactionWire>(`/transactions/${id}`, payload)
      .then(toTransaction),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/transactions/${id}`).then(() => undefined),
}

/** Both legs of a transfer move together; the ledger's own endpoints refuse legs. */
export const transfersApi = {
  create: (payload: CreateTransferWire): Promise<Transfer> =>
    http.post<TransferWire>('/transfers', payload).then(toTransfer),
  /** `transactionsApi.bulkCreate` for transfers: one verdict per transfer, in request order. */
  bulkCreate: (
    items: ReadonlyArray<CreateTransferWire>,
  ): Promise<BulkTransferResult[]> =>
    http
      .post<BulkCreateTransfersWire>('/transfers/bulk', { items })
      .then((r) => r.results.map(toBulkTransferResult)),
  /** Removes every standing leg of each transfer id; answered like `transactionsApi.bulkDelete`. */
  bulkDelete: (ids: ReadonlyArray<string>): Promise<BulkDeleteResult[]> =>
    http
      .post<BulkDeleteTransactionsWire>('/transfers/bulk-delete', { ids })
      .then((r) => r.results.map(toBulkDeleteResult)),
  update: (id: string, payload: UpdateTransferWire): Promise<Transfer> =>
    http.patch<TransferWire>(`/transfers/${id}`, payload).then(toTransfer),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/transfers/${id}`).then(() => undefined),
}

export const budgetsApi = {
  list: (): Promise<Budget[]> =>
    http.get<BudgetWire[]>('/budgets').then((r) => r.map(toBudget)),
  create: (payload: CreateBudgetWire): Promise<Budget> =>
    http.post<BudgetWire>('/budgets', payload).then(toBudget),
  update: (id: string, payload: UpdateBudgetWire): Promise<Budget> =>
    http.patch<BudgetWire>(`/budgets/${id}`, payload).then(toBudget),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/budgets/${id}`).then(() => undefined),
}

export const recurringsApi = {
  list: (): Promise<Recurring[]> =>
    http.get<RecurringWire[]>('/recurrings').then((r) => r.map(toRecurring)),
  create: (payload: CreateRecurringWire): Promise<Recurring> =>
    http.post<RecurringWire>('/recurrings', payload).then(toRecurring),
  update: (id: string, payload: UpdateRecurringWire): Promise<Recurring> =>
    http.patch<RecurringWire>(`/recurrings/${id}`, payload).then(toRecurring),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/recurrings/${id}`).then(() => undefined),
}
