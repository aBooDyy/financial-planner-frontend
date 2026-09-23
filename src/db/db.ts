import Dexie from 'dexie'
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
  LocalRecurring,
  LocalSyncWatermark,
  LocalTransaction,
  OutboxEntry,
} from './types'

/**
 * The local-first database. The UI's source of truth: reads come from here (reactively),
 * writes land here first and queue in `outbox` for the sync engine to push. See
 * `.agent-context/data-layer-and-sync.md`.
 */
class AppDatabase extends Dexie {
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
  emailConnections!: EntityTable<LocalEmailConnection, 'id'>
  inboundImports!: EntityTable<LocalInboundImport, 'id'>
  integrationKeys!: EntityTable<LocalIntegrationKey, 'id'>
  importTemplates!: EntityTable<LocalImportTemplate, 'id'>
  importBatches!: EntityTable<LocalImportBatch, 'id'>
  syncState!: EntityTable<LocalSyncWatermark, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>

  constructor() {
    super('means-app')
    // One schema, one version. The app has never shipped, so there is no installed client
    // whose database needs walking forward — a chain of upgrades here would only ever have
    // migrated a developer's own browser profile. Bump to `version(2)` the moment that stops
    // being true; until then every table is declared once, at its current shape.
    this.version(1).stores({
      appConfig: 'id',
      balanceNodes: 'id, parentId, dirty, deleted',
      balanceSettings: 'id, dirty',
      exchangeRates: 'currency, dirty',
      categories: 'id, slug, parentId, dirty, deleted',
      customCurrencies: 'id, code, dirty, deleted',
      incomeStreams: 'id, dirty, deleted',
      goals: 'id, dirty, deleted',
      goalAllocations: 'id, goalId, walletId, dirty, deleted',
      transactions:
        'id, walletId, goalId, merchantId, transferId, date, source, dirty, deleted',
      merchants: 'id, dirty, deleted',
      merchantAliases: 'id, merchantId, normalizedKey, dirty, deleted',
      budgets: 'id, dirty, deleted',
      recurrings: 'id, dirty, deleted',
      emailConnections: 'id, status',
      inboundImports: 'id, status, source, connectionId, keyId',
      integrationKeys: 'id, status',
      importTemplates: 'id, signature, dirty, deleted',
      importBatches: 'id, createdAt',
      syncState: 'id',
      outbox: '++seq, [entity+id]',
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

/** Wipe all local data — used on sign-out so the next user starts clean. `appConfig` is
 *  deliberately kept: it holds no user data, and keeping it means the next sign-in already
 *  knows the currency table offline. */
export async function clearLocalDb(): Promise<void> {
  clears += 1
  await db.transaction(
    'rw',
    [
      db.balanceNodes,
      db.balanceSettings,
      db.exchangeRates,
      db.categories,
      db.customCurrencies,
      db.incomeStreams,
      db.goals,
      db.goalAllocations,
      db.transactions,
      db.budgets,
      db.recurrings,
      db.merchants,
      db.merchantAliases,
      db.emailConnections,
      db.inboundImports,
      db.integrationKeys,
      db.importTemplates,
      db.importBatches,
      db.syncState,
      db.outbox,
    ],
    async () => {
      await Promise.all([
        db.balanceNodes.clear(),
        db.balanceSettings.clear(),
        db.exchangeRates.clear(),
        db.categories.clear(),
        db.customCurrencies.clear(),
        db.incomeStreams.clear(),
        db.goals.clear(),
        db.goalAllocations.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.recurrings.clear(),
        db.merchants.clear(),
        db.merchantAliases.clear(),
        db.emailConnections.clear(),
        db.inboundImports.clear(),
        db.integrationKeys.clear(),
        db.importTemplates.clear(),
        db.importBatches.clear(),
        // Without this the next user on this device resumes a stranger's delta window.
        db.syncState.clear(),
        db.outbox.clear(),
      ])
    },
  )
}
