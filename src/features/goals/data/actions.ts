/**
 * "Mark as done", Reopen, Pause and Resume on a goal — actions, not edits: each is applied here
 * at once and queued as its own outbox entry, which the server applies atomically. A goal's
 * PATCH never touches `closedAt` or `pausedAt`.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalGoal, OutboxOp } from '#/db/types'
import { isoOf } from '#/features/planned/data/dates'
import { goalOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { skipDueSetAsides } from '#/features/planned/data/rows'
import { queueClose } from '#/features/setAsides/data/leftover'
import type { Leftover } from '#/features/setAsides/data/leftover'

const now = () => new Date().toISOString()
const today = () => isoOf(new Date())

export type CloseGoalOptions = {
  /** The close date; defaults to today. */
  closedAt?: string
  /** What happens to money still set aside for it; defaults to freeing it. */
  leftover?: Leftover
}

async function liveGoal(id: string): Promise<LocalGoal | null> {
  const goal = await db.goals.get(id)
  return goal && goal.deleted === 0 ? goal : null
}

/** Write the goal's own change and queue the action, together. */
async function queueAction(
  goal: LocalGoal,
  change: Partial<LocalGoal>,
  op: OutboxOp,
  payload: unknown,
): Promise<void> {
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.put({ ...goal, ...change, updatedAt: now(), dirty: 1 })
    await db.outbox.add({
      op,
      entity: 'goal',
      id: goal.id,
      payload,
      baseVersion: null,
      createdAt: now(),
    })
  })
  schedulePush()
}

/**
 * Mark a goal done, whatever its progress: it counts as reached and plans nothing more. Its
 * live set-asides are released on the close date (or moved to another open bill or goal), its
 * open, unsettled planned rows after that date go, and a pause ends. "I spent it" is a spend
 * recorded with the goal before closing with the default (free) leftover.
 */
export async function closeGoal(
  id: string,
  options: CloseGoalOptions = {},
): Promise<void> {
  const goal = await liveGoal(id)
  if (!goal || goal.closedAt !== null) return
  const closedAt = options.closedAt ?? today()
  await queueClose(
    { entity: 'goal', id },
    closedAt,
    options.leftover ?? { kind: 'free' },
    async () => {
      await db.goals.put({
        ...goal,
        closedAt,
        pausedAt: null,
        updatedAt: now(),
        dirty: 1,
      })
    },
  )
  schedulePush()
}

/**
 * Undo a close: the goal's plan is rewritten from today. A pause it had before stays ended.
 */
export async function reopenGoal(id: string): Promise<void> {
  const goal = await liveGoal(id)
  if (!goal || goal.closedAt === null) return
  await queueAction(goal, { closedAt: null, pausedAt: null }, 'reopen', null)
  requestPlanRecalc(goalOwner(id), { quiet: true })
}

/**
 * Pause a goal: no planned set-asides while paused — the ones already due are skipped; money
 * already set aside stays. Refused (a no-op) on a closed or already paused goal, as the server
 * refuses it.
 */
export async function pauseGoal(
  id: string,
  pausedAt: string = today(),
): Promise<void> {
  const goal = await liveGoal(id)
  if (!goal || goal.closedAt !== null || goal.pausedAt !== null) return
  await queueAction(goal, { pausedAt }, 'pause', { paused_at: pausedAt })
  await skipDueSetAsides(id, pausedAt)
  schedulePush()
}

/** Resume a paused goal: its plan is rewritten from today. */
export async function resumeGoal(id: string): Promise<void> {
  const goal = await liveGoal(id)
  if (!goal || goal.pausedAt === null) return
  await queueAction(goal, { pausedAt: null }, 'resume', null)
  requestPlanRecalc(goalOwner(id), { quiet: true })
}
