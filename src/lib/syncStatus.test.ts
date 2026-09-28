import { describe, expect, it } from 'vitest'
import { describeSyncStatus, syncStatusOf } from './syncStatus'
import type { SyncSignals } from './syncStatus'

const calm: SyncSignals = {
  syncing: false,
  pending: 0,
  rejected: 0,
  unavailable: 0,
  lastPassFailed: false,
  lastSyncedAt: null,
}

describe('syncStatusOf', () => {
  it('is connecting until a sync has finished', () => {
    expect(syncStatusOf(calm).state).toBe('connecting')
    expect(syncStatusOf({ ...calm, lastSyncedAt: 1 }).state).toBe('synced')
  })

  it('shows a sync in flight over any trouble it may clear', () => {
    expect(
      syncStatusOf({ ...calm, syncing: true, rejected: 2, pending: 3 }),
    ).toEqual({ state: 'syncing', pending: 3 })
  })

  it('reports refused changes and an unreachable server as failed', () => {
    expect(syncStatusOf({ ...calm, rejected: 2 })).toMatchObject({
      state: 'failed',
      rejected: 2,
      unreachable: false,
    })
    expect(syncStatusOf({ ...calm, unavailable: 1 })).toMatchObject({
      state: 'failed',
      unreachable: true,
    })
    expect(syncStatusOf({ ...calm, lastPassFailed: true })).toMatchObject({
      state: 'failed',
      unreachable: true,
    })
  })

  it('says changes are waiting when some are queued without trouble', () => {
    expect(syncStatusOf({ ...calm, pending: 1, lastSyncedAt: 1 })).toEqual({
      state: 'waiting',
      pending: 1,
    })
  })
})

describe('describeSyncStatus', () => {
  const now = Date.now()

  it('counts changes in the title', () => {
    expect(describeSyncStatus({ state: 'waiting', pending: 1 }).title).toBe(
      '1 change waiting to sync',
    )
    expect(
      describeSyncStatus({
        state: 'failed',
        rejected: 3,
        unreachable: false,
        lastSyncedAt: null,
      }).title,
    ).toBe('3 changes didn’t sync')
  })

  it('names the server when it could not be reached', () => {
    expect(
      describeSyncStatus({
        state: 'failed',
        rejected: 0,
        unreachable: true,
        lastSyncedAt: null,
      }).title,
    ).toBe('Can’t reach the server')
  })

  it('says when it last synced', () => {
    const text = describeSyncStatus({
      state: 'synced',
      lastSyncedAt: now - 5 * 60_000,
    })
    expect(text.meta).toBe('Last synced 5 minutes ago')
    expect(
      describeSyncStatus({ state: 'synced', lastSyncedAt: now }).meta,
    ).toBe('Last synced just now')
  })
})
