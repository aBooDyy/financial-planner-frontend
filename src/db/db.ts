import Dexie from 'dexie'
import type { EntityTable } from 'dexie'
import type {
  LocalBalanceNode,
  LocalBalanceSettings,
  LocalBudget,
  LocalCategory,
  LocalEmailConnection,
  LocalExchangeRate,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
  LocalPendingImport,
  LocalRecurring,
  LocalTransaction,
  OutboxEntry,
} from './types'

/**
 * The local-first database. The UI's source of truth: reads come from here (reactively),
 * writes land here first and queue in `outbox` for the sync engine to push. See
 * `.agent-context/data-layer-and-sync.md`.
 */
class AppDatabase extends Dexie {
  balanceNodes!: EntityTable<LocalBalanceNode, 'id'>
  balanceSettings!: EntityTable<LocalBalanceSettings, 'id'>
  exchangeRates!: EntityTable<LocalExchangeRate, 'currency'>
  categories!: EntityTable<LocalCategory, 'id'>
  incomeStreams!: EntityTable<LocalIncomeStream, 'id'>
  goals!: EntityTable<LocalGoal, 'id'>
  goalAllocations!: EntityTable<LocalGoalAllocation, 'id'>
  transactions!: EntityTable<LocalTransaction, 'id'>
  budgets!: EntityTable<LocalBudget, 'id'>
  recurrings!: EntityTable<LocalRecurring, 'id'>
  emailConnections!: EntityTable<LocalEmailConnection, 'id'>
  emailImports!: EntityTable<LocalPendingImport, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>

  constructor() {
    super('means-app')
    this.version(1).stores({
      balanceNodes: 'id, parentId, dirty, deleted',
      balanceSettings: 'id, dirty',
      exchangeRates: 'currency',
      outbox: '++seq, [entity+id]',
    })
    // v2 adds the Goals planning entities (income streams + goals).
    this.version(2).stores({
      incomeStreams: 'id, dirty, deleted',
      goals: 'id, dirty, deleted',
    })
    // v3 adds the Spending entities (the ledger, budgets, recurring schedules).
    this.version(3).stores({
      transactions: 'id, walletId, goalId, date, dirty, deleted',
      budgets: 'id, dirty, deleted',
      recurrings: 'id, dirty, deleted',
    })
    // v4 adds the Settings entities: user-editable categories, and a `dirty` index on rates
    // (rates became per-user editable, so local edits must survive a background pull).
    this.version(4).stores({
      categories: 'id, slug, dirty, deleted',
      exchangeRates: 'currency, dirty',
    })
    // v5 adds the Email-sync read cache (connected inboxes + pending auto-logged imports).
    // Server-owned, so no dirty/deleted flags — pulls refresh, mutations call the API.
    this.version(5).stores({
      emailConnections: 'id, status',
      emailImports: 'id, status, connectionId',
    })
    // v6 adds goal allocations: the sourced reserves that make up each goal's saved progress
    // (indexed by goalId for the goals view, walletId for the per-wallet reserved breakdown).
    this.version(6).stores({
      goalAllocations: 'id, goalId, walletId, dirty, deleted',
    })
  }
}

export const db = new AppDatabase()

/** Wipe all local data — used on sign-out so the next user starts clean. */
export async function clearLocalDb(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.balanceNodes,
      db.balanceSettings,
      db.exchangeRates,
      db.categories,
      db.incomeStreams,
      db.goals,
      db.goalAllocations,
      db.transactions,
      db.budgets,
      db.recurrings,
      db.emailConnections,
      db.emailImports,
      db.outbox,
    ],
    async () => {
      await Promise.all([
        db.balanceNodes.clear(),
        db.balanceSettings.clear(),
        db.exchangeRates.clear(),
        db.categories.clear(),
        db.incomeStreams.clear(),
        db.goals.clear(),
        db.goalAllocations.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.recurrings.clear(),
        db.emailConnections.clear(),
        db.emailImports.clear(),
        db.outbox.clear(),
      ])
    },
  )
}
