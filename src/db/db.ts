import Dexie from 'dexie'
import { resetPullState } from './pullState'
import type { EntityTable } from 'dexie'
import type {
  LocalAppConfig,
  LocalBalanceNode,
  LocalBalanceSettings,
  LocalBudget,
  LocalCategory,
  LocalCustomCurrency,
  LocalEmailConnection,
  LocalExchangeRate,
  LocalGoal,
  LocalGoalAllocation,
  LocalImportBatch,
  LocalImportTemplate,
  LocalInboundImport,
  LocalIncomeStream,
  LocalIntegrationKey,
  LocalMerchant,
  LocalMerchantAlias,
  LocalPlanned,
  LocalRecurring,
  LocalSyncWatermark,
  LocalTransaction,
  OutboxEntry,
} from './types'

/**
 * Every table that mirrors server state, plus the sync bookkeeping about it: the outbox and
 * the delta watermarks. What the version-2 upgrade wipes.
 */
const SYNCED_TABLES = [
  'balanceNodes',
  'balanceSettings',
  'exchangeRates',
  'categories',
  'customCurrencies',
  'incomeStreams',
  'goals',
  'goalAllocations',
  'transactions',
  'budgets',
  'recurrings',
  'plannedTransactions',
  'merchants',
  'merchantAliases',
  'emailConnections',
  'inboundImports',
  'integrationKeys',
  'importTemplates',
  'syncState',
  'outbox',
] as const

/**
 * What a sign-out wipes: the synced tables and this device's import history. `appConfig` is
 * deliberately kept — it holds no user data, and keeping it means the next sign-in already
 * knows the currency table offline.
 */
const USER_TABLES = [...SYNCED_TABLES, 'importBatches'] as const

/**
 * The local-first database. The UI's source of truth: reads come from here (reactively),
 * writes land here first and queue in `outbox` for the sync engine to push. See
 * `.agent-context/data-layer-and-sync.md`.
 */
export class AppDatabase extends Dexie {
  appConfig!: EntityTable<LocalAppConfig, 'id'>
  balanceNodes!: EntityTable<LocalBalanceNode, 'id'>
  balanceSettings!: EntityTable<LocalBalanceSettings, 'id'>
  exchangeRates!: EntityTable<LocalExchangeRate, 'currency'>
  categories!: EntityTable<LocalCategory, 'id'>
  customCurrencies!: EntityTable<LocalCustomCurrency, 'id'>
  incomeStreams!: EntityTable<LocalIncomeStream, 'id'>
  goals!: EntityTable<LocalGoal, 'id'>
  goalAllocations!: EntityTable<LocalGoalAllocation, 'id'>
  transactions!: EntityTable<LocalTransaction, 'id'>
  merchants!: EntityTable<LocalMerchant, 'id'>
  merchantAliases!: EntityTable<LocalMerchantAlias, 'id'>
  budgets!: EntityTable<LocalBudget, 'id'>
  recurrings!: EntityTable<LocalRecurring, 'id'>
  plannedTransactions!: EntityTable<LocalPlanned, 'id'>
  emailConnections!: EntityTable<LocalEmailConnection, 'id'>
  inboundImports!: EntityTable<LocalInboundImport, 'id'>
  integrationKeys!: EntityTable<LocalIntegrationKey, 'id'>
  importTemplates!: EntityTable<LocalImportTemplate, 'id'>
  importBatches!: EntityTable<LocalImportBatch, 'id'>
  syncState!: EntityTable<LocalSyncWatermark, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>

  constructor(dbName = 'means-app') {
    super(dbName)
    // The whole schema, declared once at its current shape. Dexie diffs it against whatever
    // is installed, so older versions need no declaration of their own.
    //
    // Version 2: rows reference categories by id instead of a slug pair. Local rows and
    // queued payloads in the old shape cannot be translated without the server's ids, so
    // the upgrade drops every synced row, the outbox and the watermarks, and the next pull
    // is a first sync.
    this.version(2)
      .stores({
        appConfig: 'id',
        balanceNodes: 'id, parentId, dirty, deleted',
        balanceSettings: 'id, dirty',
        exchangeRates: 'currency, dirty',
        categories: 'id, slug, parentId, dirty, deleted',
        customCurrencies: 'id, code, dirty, deleted',
        incomeStreams: 'id, dirty, deleted',
        goals: 'id, dirty, deleted',
        goalAllocations: 'id, goalId, walletId, plannedId, dirty, deleted',
        transactions:
          'id, walletId, goalId, merchantId, transferId, categoryId, date, source, plannedId, dirty, deleted',
        merchants: 'id, dirty, deleted',
        merchantAliases: 'id, merchantId, normalizedKey, dirty, deleted',
        budgets: 'id, dirty, deleted',
        recurrings: 'id, categoryId, dirty, deleted',
        plannedTransactions:
          'id, goalId, incomeStreamId, recurringId, categoryId, status, date, dirty, deleted',
        emailConnections: 'id, status',
        inboundImports: 'id, status, source, connectionId, keyId',
        integrationKeys: 'id, status',
        importTemplates: 'id, signature, dirty, deleted',
        importBatches: 'id, createdAt',
        syncState: 'id',
        outbox: '++seq, [entity+id]',
      })
      .upgrade(async (tx) => {
        await Promise.all(SYNCED_TABLES.map((name) => tx.table(name).clear()))
      })
  }
}

export const db = new AppDatabase()

let clears = 0

/**
 * Moves every time the local data is wiped. A server read that was already in flight when the
 * session ended checks it inside its write, so it cannot refill the tables with the previous
 * user's rows.
 */
export const localDbGeneration = (): number => clears

/** Wipe all local data — used on sign-out so the next user starts clean. */
export async function clearLocalDb(): Promise<void> {
  clears += 1
  resetPullState()
  // `syncState` goes too: without it the next user on this device resumes a stranger's
  // delta window.
  await db.transaction('rw', USER_TABLES, async () => {
    await Promise.all(USER_TABLES.map((name) => db.table(name).clear()))
  })
}
