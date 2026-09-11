import { db } from '#/db/db'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  EmailConnection,
  PendingImport,
  RuleDraftWire,
  ScanFrequency,
  SyncResult,
} from '#/features/email-sync/api/types'
import { toWireFrequency } from '#/features/email-sync/api/types'
import type { TxType } from '#/features/transactions/api/types'
import { toWireTxType } from '#/features/transactions/api/types'
import { pullConnections, pullPendingImports } from './cache'
import { connectionToLocal, transactionToLocal } from './mappers'

async function cacheConnection(connection: EmailConnection): Promise<void> {
  await db.emailConnections.put(connectionToLocal(connection))
}

export async function completeOAuth(
  code: string,
  state: string,
): Promise<EmailConnection> {
  const connection = await emailSyncApi.completeOAuth(code, state)
  await cacheConnection(connection)
  return connection
}

export async function saveRules(
  connectionId: string,
  rules: RuleDraftWire[],
): Promise<EmailConnection> {
  const connection = await emailSyncApi.createRules(connectionId, rules)
  await cacheConnection(connection)
  return connection
}

export type ConnectionSettings = {
  autoSync: boolean
  autoConfirm: boolean
  scanFrequency: ScanFrequency
  defaultWalletId: string | null
}

export async function updateConnectionSettings(
  connection: EmailConnection,
  settings: ConnectionSettings,
): Promise<EmailConnection> {
  const updated = await emailSyncApi.updateConnection(connection.id, {
    version: connection.version,
    auto_sync: settings.autoSync,
    auto_confirm: settings.autoConfirm,
    scan_frequency: toWireFrequency(settings.scanFrequency),
    default_wallet_id: settings.defaultWalletId,
  })
  await cacheConnection(updated)
  return updated
}

export async function disconnectConnection(id: string): Promise<void> {
  await emailSyncApi.disconnect(id)
  await db.transaction('rw', db.emailConnections, db.emailImports, async () => {
    await db.emailConnections.delete(id)
    await db.emailImports.where('connectionId').equals(id).delete()
  })
}

/** Client-triggered scan (on login / on demand), then refresh the caches it touched. */
export async function runEmailSync(): Promise<SyncResult> {
  const result = await emailSyncApi.syncAll()
  await Promise.all([pullPendingImports(), pullConnections()])
  return result
}

/**
 * Values the user may supply at confirm time. They override whatever the sync parsed, and
 * are required when it parsed nothing — the user reads them off the stored email body.
 */
export type ConfirmOverrides = {
  amount?: number
  currency?: string
  date?: string
  merchant?: string
  note?: string
}

export async function confirmImport(
  item: PendingImport,
  input: {
    walletId: string
    category: string
    subcategory: string | null
    type: TxType
  } & ConfirmOverrides,
): Promise<void> {
  const { walletId, category, subcategory, type, ...overrides } = input
  const { transaction } = await emailSyncApi.confirmImport(item.id, {
    wallet_id: walletId,
    category,
    subcategory,
    type: toWireTxType(type),
    ...overrides,
  })
  await db.transaction('rw', db.emailImports, db.transactions, async () => {
    await db.emailImports.delete(item.id)
    // Reflect the promoted entry in the local ledger immediately (clean, already-synced).
    await db.transactions.put(transactionToLocal(transaction))
  })
}

export async function dismissImport(item: PendingImport): Promise<void> {
  await emailSyncApi.dismissImport(item.id)
  await db.emailImports.delete(item.id)
}
