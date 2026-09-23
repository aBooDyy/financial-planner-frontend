import { db } from '#/db/db'
import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  EmailConnection,
  RuleDraftWire,
  ScanFrequency,
  ScanOptions,
  SyncResult,
} from '#/features/email-sync/api/types'
import { toWireFrequency } from '#/features/email-sync/api/types'
import { dropConnectionImports } from '#/features/inbound-imports/data/cache'
import { pullInboundImportsDelta } from '#/features/inbound-imports/data/sync'
import { pullConnections } from './cache'
import { connectionToLocal } from './mappers'

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
  await db.emailConnections.delete(id)
  await dropConnectionImports(id)
}

/** Client-triggered scan (on login / on demand), then refresh the caches it touched. */
export async function runEmailSync(options?: ScanOptions): Promise<SyncResult> {
  const result = await emailSyncApi.syncAll(options)
  await Promise.all([pullInboundImportsDelta(), pullConnections()])
  return result
}
