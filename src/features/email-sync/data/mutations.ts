import { emailSyncApi } from '#/features/email-sync/api/emailSyncApi'
import type {
  ConnectionSettings,
  EmailConnection,
  EmailRuleDraft,
  EmailRuleSet,
  ScanOptions,
  SyncResult,
} from '#/features/email-sync/api/types'
import { summaryOf, toWireFrequency } from '#/features/email-sync/api/types'
import { dropConnectionImports } from '#/features/inbound-imports/data/cache'
import { pullInboundImportsDelta } from '#/features/inbound-imports/data/sync'
import {
  cacheConnection,
  pullConnections,
  recordRuleSummaries,
  uncacheConnection,
} from './cache'

export async function completeOAuth(
  code: string,
  state: string,
): Promise<EmailConnection> {
  const connection = await emailSyncApi.completeOAuth(code, state)
  await cacheConnection(connection)
  return connection
}

export async function updateConnectionSettings(
  connection: Pick<EmailConnection, 'id' | 'version'>,
  settings: ConnectionSettings,
): Promise<EmailConnection> {
  const updated = await emailSyncApi.updateConnection(connection.id, {
    version: connection.version,
    auto_sync: settings.autoSync,
    scan_frequency: toWireFrequency(settings.scanFrequency),
  })
  await cacheConnection(updated)
  return updated
}

/** Replace the inbox's whole rule set; the cached list learns the new summaries. */
export async function saveRules(
  connectionId: string,
  version: string,
  rules: EmailRuleDraft[],
): Promise<EmailRuleSet> {
  const set = await emailSyncApi.replaceRules(connectionId, version, rules)
  await recordRuleSummaries(connectionId, set.rules.map(summaryOf))
  return set
}

export async function disconnectConnection(id: string): Promise<void> {
  await emailSyncApi.disconnect(id)
  await uncacheConnection(id)
  await dropConnectionImports(id)
}

/** Client-triggered scan (on login / on demand), then refresh the caches it touched. */
export async function runEmailSync(options?: ScanOptions): Promise<SyncResult> {
  const result = await emailSyncApi.syncAll(options)
  await Promise.all([pullInboundImportsDelta(), pullConnections()])
  return result
}
