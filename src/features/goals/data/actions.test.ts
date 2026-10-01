import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalGoal } from '#/db/types'
import type { Goal } from '#/features/goals/api/types'
import { goal, m, setAside } from '#/features/planned/testing/fixtures'
import { ApiError } from '#/lib/apiError'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))
const goalsApi = vi.hoisted(() => ({
  listGoals: vi.fn(),
  closeGoal: vi.fn(),
  reopenGoal: vi.fn(),
  pauseGoal: vi.fn(),
  resumeGoal: vi.fn(),
}))
vi.mock('#/features/goals/api/goalsApi', () => ({ goalsApi }))

const { closeGoal, pauseGoal, reopenGoal, resumeGoal } =
  await import('./actions')
const { pushGoalsEntry } = await import('./sync')

const asServer = (row: LocalGoal, version: string): Goal => {
  const { dirty, deleted, ...rest } = row
  void [dirty, deleted]
  return { ...rest, version }
}
const queued = () => db.outbox.toArray()

beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all(
    [db.goals, db.setAsides, db.plannedTransactions, db.outbox].map((t) =>
      t.clear(),
    ),
  )
  await db.goals.put(goal({ id: 'trip', version: 'v1', amount: m(300) }))
})

describe('pause and resume', () => {
  it('pauses locally and queues the pause with its date', async () => {
    await pauseGoal('trip', '2026-10-02')

    expect(await db.goals.get('trip')).toMatchObject({
      pausedAt: '2026-10-02',
      dirty: 1,
    })
    const [entry] = await queued()
    expect(entry).toMatchObject({
      entity: 'goal',
      op: 'pause',
      payload: { paused_at: '2026-10-02' },
    })

    goalsApi.pauseGoal.mockImplementation(
      (_id: string, body: { version: string; paused_at: string }) =>
        Promise.resolve(
          asServer(goal({ id: 'trip', pausedAt: body.paused_at }), 'v2'),
        ),
    )
    await pushGoalsEntry(entry)

    expect(goalsApi.pauseGoal).toHaveBeenCalledWith('trip', {
      version: 'v1',
      paused_at: '2026-10-02',
    })
    expect(await db.goals.get('trip')).toMatchObject({
      pausedAt: '2026-10-02',
      version: 'v2',
      dirty: 0,
    })
  })

  it('never pauses a closed or paused goal, and resumes only a paused one', async () => {
    await resumeGoal('trip')
    expect(await queued()).toEqual([])

    await pauseGoal('trip', '2026-10-02')
    await pauseGoal('trip', '2026-10-03')
    expect(await queued()).toHaveLength(1)

    await resumeGoal('trip')
    expect((await db.goals.get('trip'))?.pausedAt).toBeNull()
    expect((await queued()).map((e) => e.op)).toEqual(['pause', 'resume'])
  })

  it('settles a pause the server refuses on a goal already closed elsewhere', async () => {
    await pauseGoal('trip', '2026-10-02')
    goalsApi.pauseGoal.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'goals.goal.already_closed',
        message: '',
      }),
    )
    goalsApi.listGoals.mockResolvedValue([
      asServer(goal({ id: 'trip', closedAt: '2026-10-01' }), 'v5'),
    ])

    await pushGoalsEntry((await queued())[0])

    expect(await queued()).toEqual([])
    expect(await db.goals.get('trip')).toMatchObject({
      closedAt: '2026-10-01',
      pausedAt: null,
      dirty: 0,
    })
  })
})

describe('close and reopen', () => {
  it('closes with the pause ended and the live set-asides freed', async () => {
    await db.goals.put(
      goal({ id: 'trip', version: 'v1', pausedAt: '2026-09-01' }),
    )
    await db.setAsides.put(setAside({ id: 'a1', goalId: 'trip' }))

    await closeGoal('trip', { closedAt: '2026-10-02' })

    expect(await db.goals.get('trip')).toMatchObject({
      closedAt: '2026-10-02',
      pausedAt: null,
    })
    expect((await db.setAsides.get('a1'))?.releasedAt).toBe('2026-10-02')
    const [entry] = await queued()
    expect(entry).toMatchObject({
      entity: 'goal',
      op: 'close',
      payload: { closed_at: '2026-10-02', leftover: 'FREE' },
    })
  })

  it('reopens a closed goal', async () => {
    await db.goals.put(
      goal({ id: 'trip', version: 'v1', closedAt: '2026-10-02' }),
    )
    await reopenGoal('trip')
    expect((await db.goals.get('trip'))?.closedAt).toBeNull()
    expect((await queued()).map((e) => e.op)).toEqual(['reopen'])
  })
})
