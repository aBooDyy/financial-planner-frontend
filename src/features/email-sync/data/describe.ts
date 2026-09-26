import type { EmailProvider, LocalEmailConnection } from '#/db/types'
import { formatRelativeTime } from '#/lib/date'

export const PROVIDER_LABEL: Record<EmailProvider, string> = {
  google: 'Gmail',
  outlook: 'Outlook',
}

/** `reading` — some rule is on; `idle` — rules exist but all are paused; `empty` — none yet. */
export type InboxHealth = 'reading' | 'idle' | 'empty'

export function inboxHealth(connection: LocalEmailConnection): InboxHealth {
  if (connection.rules.length === 0) return 'empty'
  return connection.rules.some((r) => r.enabled) ? 'reading' : 'idle'
}

export const ruleCountLabel = (count: number): string =>
  count === 0 ? 'No rules yet' : count === 1 ? '1 rule' : `${count} rules`

/** How recent the last sync was is the question here, not which calendar day it fell on. */
export function lastSyncedLabel(iso: string | null, locale: string): string {
  const when = iso === null ? null : formatRelativeTime(iso, locale)
  return when === null ? 'Never synced' : `Synced ${when}`
}

/** An inbox's second line: provider · rules · last sync. */
export function describeInbox(
  connection: LocalEmailConnection,
  locale: string,
): string[] {
  const paused = connection.rules.filter((r) => !r.enabled).length
  const rules = ruleCountLabel(connection.rules.length)
  return [
    PROVIDER_LABEL[connection.provider],
    paused > 0 && paused < connection.rules.length
      ? `${rules} (${paused} paused)`
      : inboxHealth(connection) === 'idle'
        ? `${rules}, all paused`
        : rules,
    lastSyncedLabel(connection.lastSyncedAt, locale),
  ]
}
