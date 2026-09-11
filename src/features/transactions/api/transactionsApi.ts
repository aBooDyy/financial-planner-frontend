import { http } from '#/lib/http'
import type {
  Budget,
  BudgetWire,
  CreateBudgetWire,
  CreateRecurringWire,
  CreateTransactionWire,
  Recurring,
  RecurringWire,
  Transaction,
  TransactionWire,
  UpdateBudgetWire,
  UpdateRecurringWire,
  UpdateTransactionWire,
} from './types'
import { toBudget, toRecurring, toTransaction } from './types'

/**
 * Remote calls for the Spending entities (transactions, budgets, recurring schedules). The
 * sync engine owns when these run; UI reads from the local DB, never from here directly.
 */
export const transactionsApi = {
  list: (): Promise<Transaction[]> =>
    http
      .get<TransactionWire[]>('/transactions')
      .then((r) => r.map(toTransaction)),
  create: (payload: CreateTransactionWire): Promise<Transaction> =>
    http.post<TransactionWire>('/transactions', payload).then(toTransaction),
  update: (id: string, payload: UpdateTransactionWire): Promise<Transaction> =>
    http
      .patch<TransactionWire>(`/transactions/${id}`, payload)
      .then(toTransaction),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/transactions/${id}`).then(() => undefined),
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
