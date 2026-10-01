import Dexie from 'dexie'
import { removeCachedUser } from '#/stores/cachedUser'
import { ledgerTotalsMiddleware } from './ledgerTotalsMiddleware'
import { resetPullState } from './pullState'
import { totalsOf } from '#/features/transactions/data/ledgerTotals'
import type { EntityTable } from 'dexie'
import type {
  LocalAppConfig,
  LocalBalanceNode,
  LocalBalanceSettings,
  LocalBill,
  LocalBudget,
  LocalCategory,
  LocalCustomCurrency,
  LocalEmailConnection,
  LocalExchangeRate,
  LocalGoal,
  LocalImportBatch,
  LocalImportTemplate,
  LocalInboundImport,
  LocalIncomeStream,
  LocalIntegrationKey,
  LocalLedgerTotal,
  LocalMerchant,
  LocalMerchantAlias,
  LocalPlanned,
  LocalSetAside,
  LocalSyncWatermark,
  LocalTransaction,
  OutboxEntry,
} from './types'

/**
 * Every table that mirrors server state, plus the sync bookkeeping about it: the outbox and
 * the delta watermarks.
 */
const SYNCED_TABLES = [
  'balanceNodes',
  'balanceSettings',
  'exchangeRates',
  'categories',
  'customCurrencies',
  'incomeStreams',
  'goals',
  'bills',
  'setAsides',
  'transactions',
  'budgets',
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
 * What a sign-out wipes: the synced tables, what is derived from them, and this device's
 * import history. `appConfig` is deliberately kept — it holds no user data, and keeping it
 * means the next sign-in already knows the currency table offline.
 */
const USER_TABLES = [...SYNCED_TABLES, 'ledgerTotals', 'importBatches'] as const

/** The tables the version-2 upgrade wiped: what the synced set was then. */
const VERSION_2_SYNCED_TABLES = [
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
 * The planning model the version-4 upgrade replaced: its rows (and any queued write of them)
 * are in a shape the server no longer takes, and the server dropped the data behind them.
 */
const RETIRED_PLANNING_TABLES = [
  'goals',
  'incomeStreams',
  'plannedTransactions',
] as const
const RETIRED_OUTBOX_ENTITIES = [
  'recurring',
  'allocation',
  'goal',
  'income',
  'planned',
]
/** Per-user `syncState` rows that must start over with the planning tables. */
const RETIRED_SYNC_STATE = [':planned', ':plannerInputs']

/** A queued ledger payload without the links the server cleared. */
const unlinkedPayload = (payload: unknown): unknown =>
  payload && typeof payload === 'object' && 'goal_id' in payload
    ? { ...payload, goal_id: null, planned_id: null }
    : payload

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
  bills!: EntityTable<LocalBill, 'id'>
  setAsides!: EntityTable<LocalSetAside, 'id'>
  transactions!: EntityTable<LocalTransaction, 'id'>
  ledgerTotals!: EntityTable<LocalLedgerTotal, 'id'>
  merchants!: EntityTable<LocalMerchant, 'id'>
  merchantAliases!: EntityTable<LocalMerchantAlias, 'id'>
  budgets!: EntityTable<LocalBudget, 'id'>
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
    // The whole schema as of version 2, and each later version's change on top of it. Dexie
    // diffs them against whatever is installed, so older versions need no declaration.
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
        await Promise.all(
          VERSION_2_SYNCED_TABLES.map((name) => tx.table(name).clear()),
        )
      })
    // Version 3: running totals over the ledger, built from the rows already on the device.
    this.version(3)
      .stores({ ledgerTotals: 'id, kind' })
      .upgrade(async (tx) => {
        const rows = await tx.table<LocalTransaction>('transactions').toArray()
        await tx.table('ledgerTotals').bulkPut(totalsOf(rows))
      })
    // Version 4: the planning model. Recurring schedules and goal allocations become bills
    // and set-asides; goals, income streams and planned rows take a new shape. The server
    // dropped and recreated all of it, so the old rows, their queued writes and the planned
    // watermark go, and the next pull is a first sync of the new tables. Ledger rows stay but
    // lose their goal and planned links, which the server cleared too.
    this.version(4)
      .stores({
        recurrings: null,
        goalAllocations: null,
        bills: 'id, categoryId, walletId, dirty, deleted',
        setAsides: 'id, goalId, billId, walletId, plannedId, dirty, deleted',
        plannedTransactions:
          'id, goalId, incomeStreamId, billId, categoryId, status, date, dirty, deleted',
        transactions:
          'id, walletId, goalId, billId, merchantId, transferId, categoryId, date, source, plannedId, dirty, deleted',
      })
      .upgrade(async (tx) => {
        await Promise.all(
          RETIRED_PLANNING_TABLES.map((name) => tx.table(name).clear()),
        )
        const outbox = tx.table<OutboxEntry, number>('outbox')
        await outbox
          .filter((e) => RETIRED_OUTBOX_ENTITIES.includes(e.entity))
          .delete()
        await outbox
          .filter((e) => e.entity === 'transaction')
          .modify((e) => {
            e.payload = unlinkedPayload(e.payload)
          })
        await tx
          .table<LocalSyncWatermark, string>('syncState')
          .filter((w) => RETIRED_SYNC_STATE.some((end) => w.id.endsWith(end)))
          .delete()
        await tx
          .table<LocalTransaction, string>('transactions')
          .filter((t) => t.goalId !== null || t.plannedId !== null)
          .modify({ goalId: null, plannedId: null })
      })
    this.use(ledgerTotalsMiddleware)
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
  // The cached user would reopen this device signed in over the tables emptied below.
  removeCachedUser()
  // `syncState` goes too: without it the next user on this device resumes a stranger's
  // delta window.
  await db.transaction('rw', USER_TABLES, async () => {
    await Promise.all(USER_TABLES.map((name) => db.table(name).clear()))
  })
}
