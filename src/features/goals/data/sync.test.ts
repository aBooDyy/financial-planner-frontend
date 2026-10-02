import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalGoal, OutboxEntry } from '#/db/types'
import type { Goal } from '#/features/goals/api/types'
import { goal } from '#/features/planned/testing/fixtures'

const goalsApi = vi.hoisted(() => ({
  listGoals: vi.fn(),
  listIncome: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  pauseGoal: vi.fn(),
}))
vi.mock('#/features/goals/api/goalsApi', () => ({ goalsApi }))

const { pushGoalsEntry } = await import('./sync')

const asServer = (row: LocalGoal, version: string): Goal => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({ ...entry, createdAt: '' })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([db.goals.clear(), db.outbox.clear()])
})

describe('pushGoalsEntry', () => {
  it('keeps a pause queued behind an edit on the goal when the edit lands', async () => {
    const local = goal({
      id: 'trip',
      pausedAt: '2026-10-02',
      dirty: 1,
      version: 'v1',
    })
    await db.goals.put(local)
    goalsApi.updateGoal.mockResolvedValue(
      asServer({ ...local, pausedAt: null }, 'v2'),
    )
    const edit = await queue({
      op: 'update',
      entity: 'goal',
      id: 'trip',
      payload: {},
      baseVersion: 'v1',
    })
    await queue({
      op: 'pause',
      entity: 'goal',
      id: 'trip',
      payload: { paused_at: '2026-10-02' },
      baseVersion: null,
    })

    await pushGoalsEntry(edit)

    expect(await db.goals.get('trip')).toMatchObject({
      pausedAt: '2026-10-02',
      version: 'v2',
      dirty: 1,
    })
  })
})
