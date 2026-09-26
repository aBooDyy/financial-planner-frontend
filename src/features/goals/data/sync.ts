import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import { allocationsApi } from '#/features/goals/api/allocationsApi'
import { goalsApi } from '#/features/goals/api/goalsApi'
import type {
  CreateGoalAllocationWire,
  CreateGoalWire,
  CreateIncomeWire,
  UpdateGoalAllocationWire,
  UpdateGoalWire,
  UpdateIncomeWire,
} from '#/features/goals/api/types'
import { ApiError } from '#/lib/apiError'
import {
  localAllocationToUpdateWire,
  localGoalToUpdateWire,
  localIncomeToUpdateWire,
  serverAllocationToLocal,
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

// --- Goal allocations ----------------------------------------------------------------

async function pushAllocationCreate(entry: OutboxEntry): Promise<void> {
  try {
    const allocation = await allocationsApi.create(
      entry.payload as CreateGoalAllocationWire,
    )
    await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
      await db.goalAllocations.put(serverAllocationToLocal(allocation))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) === 409) {
      await db.outbox.delete(entry.seq)
      await pullAllocations()
      return
    }
    throw e
  }
}

async function pushAllocationUpdate(entry: OutboxEntry): Promise<void> {
  const id = entry.id
  try {
    const allocation = await allocationsApi.update(
      id,
      entry.payload as UpdateGoalAllocationWire,
    )
    await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
      await db.goalAllocations.put(serverAllocationToLocal(allocation))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    const status = statusOf(e)
    if (status === 409) {
      await rebaseAllocation(entry)
      return
    }
    if (status === 404) {
      await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
        await db.goalAllocations.delete(id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

async function rebaseAllocation(entry: OutboxEntry): Promise<void> {
  const fresh = (await allocationsApi.list()).find((a) => a.id === entry.id)
  const local = await db.goalAllocations.get(entry.id)
  if (!fresh || !local) {
    await db.outbox.delete(entry.seq)
    return
  }
  try {
    const allocation = await allocationsApi.update(
      entry.id,
      localAllocationToUpdateWire({ ...local, version: fresh.version }),
    )
    await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
      await db.goalAllocations.put(serverAllocationToLocal(allocation))
      await db.outbox.delete(entry.seq)
    })
  } catch (e) {
    if (statusOf(e) !== 409) throw e
    await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
      await db.goalAllocations.put(serverAllocationToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushAllocationDelete(entry: OutboxEntry): Promise<void> {
  try {
    await allocationsApi.del(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e
  }
  await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
    await db.goalAllocations.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

export async function pullAllocations(): Promise<void> {
  const server = await allocationsApi.list()
  const serverIds = new Set(server.map((a) => a.id))
  await db.transaction('rw', db.goalAllocations, async () => {
    for (const a of server) {
      const local = await db.goalAllocations.get(a.id)
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.goalAllocations.put(serverAllocationToLocal(a))
      }
    }
    for (const l of await db.goalAllocations.toArray()) {
      if (l.dirty === 0 && !serverIds.has(l.id)) {
        await db.goalAllocations.delete(l.id)
      }
    }
  })
}

// --- Engine plug-ins -----------------------------------------------------------------

/** Push one income/goal/allocation outbox entry. Throws on network/unexpected errors. */
export async function pushGoalsEntry(entry: OutboxEntry): Promise<void> {
  if (entry.entity === 'income') {
    if (entry.op === 'create') return pushIncomeCreate(entry)
    if (entry.op === 'update') return pushIncomeUpdate(entry)
    return pushIncomeDelete(entry)
  }
  if (entry.entity === 'allocation') {
    if (entry.op === 'create') return pushAllocationCreate(entry)
    if (entry.op === 'update') return pushAllocationUpdate(entry)
    return pushAllocationDelete(entry)
  }
  if (entry.op === 'create') return pushGoalCreate(entry)
  if (entry.op === 'update') return pushGoalUpdate(entry)
  return pushGoalDelete(entry)
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
  await Promise.all([pullIncome(), pullGoals(), pullAllocations()])
}
