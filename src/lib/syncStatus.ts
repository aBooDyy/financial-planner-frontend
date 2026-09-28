import { formatRelativeTime } from './date'

export type SyncStatus =
  | { state: 'connecting' }
  | { state: 'syncing'; pending: number }
  | { state: 'waiting'; pending: number }
  | { state: 'synced'; lastSyncedAt: number }
  | {
      state: 'failed'
      rejected: number
      /** The server could not be reached, as opposed to refusing a change. */
      unreachable: boolean
      lastSyncedAt: number | null
    }

export type SyncSignals = {
  syncing: boolean
  pending: number
  rejected: number
  unavailable: number
  lastPassFailed: boolean
  lastSyncedAt: number | null
}

/** The one state the nav's sync mark shows. A sync in flight outranks trouble it may clear. */
export function syncStatusOf(s: SyncSignals): SyncStatus {
  if (s.syncing) return { state: 'syncing', pending: s.pending }
  const unreachable = s.lastPassFailed || s.unavailable > 0
  if (s.rejected > 0 || unreachable) {
    return {
      state: 'failed',
      rejected: s.rejected,
      unreachable,
      lastSyncedAt: s.lastSyncedAt,
    }
  }
  if (s.pending > 0) return { state: 'waiting', pending: s.pending }
  if (s.lastSyncedAt !== null) {
    return { state: 'synced', lastSyncedAt: s.lastSyncedAt }
  }
  return { state: 'connecting' }
}

export type SyncStatusText = {
  title: string
  hint: string
  /** When it last synced, when that is worth saying. */
  meta: string | null
}

const changes = (count: number): string =>
  `${count} ${count === 1 ? 'change' : 'changes'}`

const JUST_NOW_MS = 60_000

const lastSynced = (at: number | null, locale: string): string | null => {
  if (at === null) return null
  if (Date.now() - at < JUST_NOW_MS) return 'Last synced just now'
  const when = formatRelativeTime(new Date(at).toISOString(), locale)
  return when ? `Last synced ${when}` : null
}

export function describeSyncStatus(
  status: SyncStatus,
  locale = 'en-US',
): SyncStatusText {
  switch (status.state) {
    case 'connecting':
      return {
        title: 'Getting ready to sync',
        hint: 'Your data is saved on this device and syncs with your account in a moment.',
        meta: null,
      }
    case 'syncing':
      return {
        title: 'Syncing',
        hint:
          status.pending > 0
            ? `Sending ${changes(status.pending)} to your account and checking for updates.`
            : 'Checking your account for updates from your other devices.',
        meta: null,
      }
    case 'waiting':
      return {
        title: `${changes(status.pending)} waiting to sync`,
        hint: 'Saved on this device. They go up to your account in a moment.',
        meta: null,
      }
    case 'synced':
      return {
        title: 'All changes synced',
        hint: 'Everything on this device is backed up to your account.',
        meta: lastSynced(status.lastSyncedAt, locale),
      }
    case 'failed':
      return status.rejected > 0
        ? {
            title: `${changes(status.rejected)} didn’t sync`,
            hint: 'The server turned them down, so they’re kept on this device. Marked rows say why; retry once they’re fixed.',
            meta: lastSynced(status.lastSyncedAt, locale),
          }
        : {
            title: 'Can’t reach the server',
            hint: 'Your changes are safe on this device. Sync keeps trying on its own, or you can retry now.',
            meta: lastSynced(status.lastSyncedAt, locale),
          }
  }
}
