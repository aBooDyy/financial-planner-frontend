// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalDb, db } from '#/db/db'
import type { User } from '#/features/auth/api/types'
import { useSessionStore } from '#/stores/session'
import { endSession } from './endSession'

/** A cached user left behind would reopen this device signed in over emptied tables. */

const KEY = 'fp-session-user'

const user: User = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  onboardedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
}

beforeEach(async () => {
  localStorage.clear()
  useSessionStore.getState().setUser(user)
  await db.syncState.put({ id: 'u1:transaction', since: 'x', updatedAt: 'x' })
})

describe('the cached user across a sign-out', () => {
  it('is removed, with the local data, when the session ends', async () => {
    expect(localStorage.getItem(KEY)).not.toBeNull()

    await endSession()

    expect(useSessionStore.getState().status).toBe('anonymous')
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(await db.syncState.count()).toBe(0)
  })

  it('is removed by the local-data wipe on its own', async () => {
    await clearLocalDb()

    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
