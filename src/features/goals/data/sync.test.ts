import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalGoal, LocalIncomeStream, OutboxEntry } from '#/db/types'
import type { Goal, IncomeStream } from '#/features/goals/api/types'
import { goal, income } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

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
const incomeAsServer = (
  row: LocalIncomeStream,
  version: string,
): IncomeStream => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}
const taken = (code: string) => new ApiError({ status: 409, code, message: '' })

const queue = async (
  entry: Omit<OutboxEntry, 'seq' | 'createdAt'>,
): Promise<OutboxEntry> => {
  const seq = await db.outbox.add({ ...entry, createdAt: '' })
  return (await db.outbox.get(seq)) as OutboxEntry
}

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all(
    [db.goals, db.incomeStreams, db.outbox].map((t) => t.clear()),
  )
})

describe('pushGoalsEntry', () => {
  it('adopts the server goal, clean, when a create’s id is already taken', async () => {
    const local = goal({ id: 'trip', dirty: 1, version: '' })
    await db.goals.put(local)
    goalsApi.createGoal.mockRejectedValue(taken('goals.goal.id_taken'))
    goalsApi.listGoals.mockResolvedValue([asServer(local, 'v1')])
    const entry = await queue({
      op: 'create',
      entity: 'goal',
      id: 'trip',
      payload: {},
      baseVersion: null,
    })

    await pushGoalsEntry(entry)

    expect(goalsApi.updateGoal).not.toHaveBeenCalled()
    expect(await db.goals.get('trip')).toMatchObject({
      version: 'v1',
      dirty: 0,
    })
    expect(await db.outbox.count()).toBe(0)
  })

  it('adopts the server income stream, clean, when a create’s id is already taken', async () => {
    const local = income({ id: 'pay', dirty: 1, version: '' })
    await db.incomeStreams.put(local)
    goalsApi.createIncome.mockRejectedValue(taken('goals.income.id_taken'))
    goalsApi.listIncome.mockResolvedValue([incomeAsServer(local, 'v1')])
    const entry = await queue({
      op: 'create',
      entity: 'income',
      id: 'pay',
      payload: {},
      baseVersion: null,
    })

    await pushGoalsEntry(entry)

    expect(goalsApi.updateIncome).not.toHaveBeenCalled()
    expect(await db.incomeStreams.get('pay')).toMatchObject({
      version: 'v1',
      dirty: 0,
    })
  })

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
