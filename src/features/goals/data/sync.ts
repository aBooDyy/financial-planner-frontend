import { db } from '#/db/db'
import { pushItemAction } from '#/db/itemAction'
import type { OutboxEntry } from '#/db/types'
import { goalsApi } from '#/features/goals/api/goalsApi'
import type {
  CreateGoalWire,
  CreateIncomeWire,
  Goal,
  UpdateGoalWire,
  UpdateIncomeWire,
} from '#/features/goals/api/types'
import type { CloseWire } from '#/features/setAsides/api/types'
import {
  resyncSetAsides,
  storeServerSetAsides,
} from '#/features/setAsides/data/sync'
import { ApiError } from '#/lib/apiError'
import {
  localGoalToUpdateWire,
  localIncomeToUpdateWire,
  serverGoalToLocal,
  serverIncomeToLocal,
} from './mappers'

/**
 * Push/pull handlers for the Goals planning entities, plugged into the shared sync engine
 * (`db/sync.ts`). They mirror the balances handlers: last-synced `version` is the optimistic
 * base, 409 rebases-and-retries once, 404 drops the local row, network errors bubble up so the
 * engine stops draining and retries later.
 */

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)

// --- Income streams ------------------------------------------------------------------

async function pushIncomeCreate(entry: OutboxEntry): Promise<void> {
  try {
    const stream = await goalsApi.createIncome(
      entry.payload as CreateIncomeWire,
    )
    await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
      await db.incomeStreams.put(serverIncomeToLocal(stream))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullIncome()
      return
    }
    throw e
  }
}

async function pushIncomeUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const stream = await goalsApi.updateIncome(
      id,
      entry.payload as UpdateIncomeWire,
    )
    await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
      await db.incomeStreams.put(serverIncomeToLocal(stream))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) {
      await rebaseIncome(entry)
      return
    }
    if (status === 404) {
      await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
        await db.incomeStreams.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseIncome(entry: OutboxEntry): Promise<void> {
  const fresh = (await goalsApi.listIncome()).find((s) => s.id === entry.id)
  const local = await db.incomeStreams.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const stream = await goalsApi.updateIncome(
      entry.id,
      localIncomeToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
      await db.incomeStreams.put(serverIncomeToLocal(stream))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
      await db.incomeStreams.put(serverIncomeToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushIncomeDelete(entry: OutboxEntry): Promise<void> {
  try {
    await goalsApi.deleteIncome(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await db.incomeStreams.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Goals ---------------------------------------------------------------------------

async function pushGoalCreate(entry: OutboxEntry): Promise<void> {
  try {
    const goal = await goalsApi.createGoal(entry.payload as CreateGoalWire)
    await db.transaction('rw', db.goals, db.outbox, async () => {
      await db.goals.put(serverGoalToLocal(goal))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullGoals()
      return
    }
    throw e
  }
}

async function pushGoalUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const goal = await goalsApi.updateGoal(id, entry.payload as UpdateGoalWire)
    await db.transaction('rw', db.goals, db.outbox, async () => {
      await db.goals.put(serverGoalToLocal(goal))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) {
      await rebaseGoal(entry)
      return
    }
    if (status === 404) {
      await db.transaction('rw', db.goals, db.outbox, async () => {
        await db.goals.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseGoal(entry: OutboxEntry): Promise<void> {
  const fresh = (await goalsApi.listGoals()).find((g) => g.id === entry.id)
  const local = await db.goals.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const goal = await goalsApi.updateGoal(
      entry.id,
      localGoalToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.goals, db.outbox, async () => {
      await db.goals.put(serverGoalToLocal(goal))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.goals, db.outbox, async () => {
      await db.goals.put(serverGoalToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushGoalDelete(entry: OutboxEntry): Promise<void> {
  try {
    await goalsApi.deleteGoal(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

// --- Goal actions --------------------------------------------------------------------

const goalVersionOf = async (id: string): Promise<string | undefined> =>
  (await goalsApi.listGoals()).find((g) => g.id === id)?.version

/** Take the server's copy of the goal, or drop it when the server no longer has it. */
async function adoptServerGoal(id: string): Promise<void> {
  const fresh = (await goalsApi.listGoals()).find((g) => g.id === id)
  if (fresh) await db.goals.put(serverGoalToLocal(fresh))
  else await db.goals.delete(id)
}

/** The shared shape of the four goal actions; only the call and its "already done" codes vary. */
async function pushGoalAction(
  entry: OutboxEntry,
  send: (version: string) => Promise<Goal>,
  doneCodes: ReadonlyArray<string>,
): Promise<void> {
  await pushItemAction(entry, {
    localVersion: async () => (await db.goals.get(entry.id))?.version,
    freshVersion: () => goalVersionOf(entry.id),
    send,
    store: async (goal) => {
      await db.goals.put(serverGoalToLocal(goal))
    },
    adopt: () => adoptServerGoal(entry.id),
    gone: () => db.goals.delete(entry.id),
    doneCodes,
  })
}

async function pushGoalClose(entry: OutboxEntry): Promise<void> {
  const payload = entry.payload as CloseWire
  await pushItemAction(entry, {
    localVersion: async () => (await db.goals.get(entry.id))?.version,
    freshVersion: () => goalVersionOf(entry.id),
    send: (version) => goalsApi.closeGoal(entry.id, { ...payload, version }),
    store: async ({ goal, released, created }) => {
      await db.goals.put(serverGoalToLocal(goal))
      await storeServerSetAsides([...released, ...created])
    },
    adopt: async () => {
      const own = await db.setAsides
        .where('goalId')
        .equals(entry.id)
        .primaryKeys()
      await adoptServerGoal(entry.id)
      await resyncSetAsides([
        ...own,
        ...Object.values(payload.move_to?.new_ids ?? {}),
      ])
    },
    gone: () => db.goals.delete(entry.id),
    doneCodes: ['goals.goal.already_closed'],
  })
}

function pushGoalOtherAction(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  if (entry.op === 'reopen')
    return pushGoalAction(
      entry,
      (version) => goalsApi.reopenGoal(id, { version }),
      ['goals.goal.not_closed'],
    )
  if (entry.op === 'pause') {
    const { paused_at } = entry.payload as { paused_at: string }
    return pushGoalAction(
      entry,
      (version) => goalsApi.pauseGoal(id, { version, paused_at }),
      // A closed goal cannot be paused: the server's copy is the answer either way.
      ['goals.goal.already_paused', 'goals.goal.already_closed'],
    )
  }
  return pushGoalAction(
    entry,
    (version) => goalsApi.resumeGoal(id, { version }),
    ['goals.goal.not_paused'],
  )
}

// --- Engine plug-ins -----------------------------------------------------------------

/** Push one income/goal outbox entry. Throws on network/unexpected errors. */
export async function pushGoalsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'income') {
    if (entry.op === 'create') return pushIncomeCreate(entry)
    if (entry.op === 'update') return pushIncomeUpdate(entry)
    return pushIncomeDelete(entry)
  }
  if (entry.op === 'create') return pushGoalCreate(entry)
  if (entry.op === 'update') return pushGoalUpdate(entry)
  if (entry.op === 'delete') return pushGoalDelete(entry)
  if (entry.op === 'close') return pushGoalClose(entry)
  return pushGoalOtherAction(entry)
}

export async function pullIncome(): Promise<void> {
  const server = await goalsApi.listIncome()
  const serverIds = new Set(server.map((s) => s.id))
  await db.transaction('rw', db.incomeStreams, async () => {
    for (const s of server) {
      const local = await db.incomeStreams.get(s.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.incomeStreams.put(serverIncomeToLocal(s))
      }
    }
    for (const l of await db.incomeStreams.toArray()) {
      if (l.dirty === 0 && !serverIds.has(l.id)) {
        await db.incomeStreams.delete(l.id)
      }
    }
  })
}

export async function pullGoals(): Promise<void> {
  const server = await goalsApi.listGoals()
  const serverIds = new Set(server.map((g) => g.id))
  await db.transaction('rw', db.goals, async () => {
    for (const g of server) {
      const local = await db.goals.get(g.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.goals.put(serverGoalToLocal(g))
      }
    }
    for (const l of await db.goals.toArray()) {
      if (l.dirty === 0 && !serverIds.has(l.id)) {
        await db.goals.delete(l.id)
      }
    }
  })
}

export async function pullGoalsAll(): Promise<void> {
  await Promise.all([pullIncome(), pullGoals()])
}
