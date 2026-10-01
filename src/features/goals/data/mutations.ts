import { db } from '#/db/db'
import { requeued } from '#/db/syncFailure'
import { schedulePush } from '#/db/sync'
import { newId } from '#/lib/uuid'
import type {
  AllocationSource,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
  OutboxEntity,
} from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type {
  GoalFrequency,
  GoalKind,
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { forgetMainIncomeStream } from '#/features/wallets/data/mutations'
import { closeCovered, reopenUnderSettled } from '#/features/planned/data/rows'
import {
  localAllocationToCreateWire,
  localAllocationToUpdateWire,
  localGoalToCreateWire,
  localGoalToUpdateWire,
  localIncomeToCreateWire,
  localIncomeToUpdateWire,
} from './mappers'
import { startOfToday, ymd } from './planning'

export type IncomeDraft = {
  label: string
  amount: number
  currency: CurrencyCode
  frequency: GoalFrequency
  day: number
  color: string
  /** Undefined on update leaves the deposit wallet alone. */
  walletId?: string | null
  /** A known payday; undefined on update leaves it alone. */
  anchorDate?: string | null
}

export type GoalDraft = {
  kind: GoalKind
  name: string
  currency: CurrencyCode
  color: string
  amount: number | null
  target: number | null
  saved: number
  frequency: ObligationFrequency | null
  /** Read only when `frequency` is 'custom'. */
  customInterval?: number | null
  customUnit?: IntervalUnit | null
  nextDue: string | null
  dueDate: string | null
  /** Undefined keeps the stored value (a new goal: the 1st). */
  setAsideDay?: number | null
  /** Undefined keeps the stored value (a new goal: off). */
  payOnDue?: boolean
}

/** The stored plan's header, written by the planner when it (re)generates a goal's rows. */
export type GoalPlanSnapshot = Pick<
  LocalGoal,
  'plannedAt' | 'planAmount' | 'planCount' | 'planStart'
>

const now = () => new Date().toISOString()
const pending = (entity: OutboxEntity, id: string) =>
  db.outbox.where('[entity+id]').equals([entity, id])

const liveIncome = async (): Promise<LocalIncomeStream[]> =>
  (await db.incomeStreams.toArray()).filter((s) => s.deleted === 0)

const liveGoals = async (): Promise<LocalGoal[]> =>
  (await db.goals.toArray()).filter((g) => g.deleted === 0)

async function nextIncomePosition(): Promise<number> {
  return (await liveIncome()).reduce((m, s) => Math.max(m, s.position), -1) + 1
}

async function nextGoalPosition(): Promise<number> {
  return (await liveGoals()).reduce((m, g) => Math.max(m, g.position), -1) + 1
}

/** Queue/refresh a create-or-update for a record that already has a pending op, else add an update. */
async function enqueueUpsert(
  entity: OutboxEntity,
  id: string,
  version: string,
  createPayload: unknown,
  updatePayload: unknown,
): Promise<void> {
  const entries = await pending(entity, id).toArray()
  const create = entries.find((e) => e.op === 'create')
  if (create) {
    create.payload = createPayload
    await db.outbox.put(requeued(create))
    return
  }
  const update = entries.find((e) => e.op === 'update')
  if (update) {
    update.payload = updatePayload
    update.baseVersion = version
    await db.outbox.put(requeued(update))
    return
  }
  await db.outbox.add({
    op: 'update',
    entity,
    id,
    payload: updatePayload,
    baseVersion: version,
    createdAt: now(),
  })
}

// --- Income streams ------------------------------------------------------------------

export async function createIncome(draft: IncomeDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const stream: LocalIncomeStream = {
    id,
    label: draft.label,
    amount: draft.amount,
    currency: draft.currency,
    frequency: draft.frequency,
    day: draft.day,
    color: draft.color,
    position: await nextIncomePosition(),
    walletId: draft.walletId ?? null,
    anchorDate: draft.anchorDate ?? null,
    createdAt: ts,
    updatedAt: ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await db.incomeStreams.put(stream)
    await db.outbox.add({
      op: 'create',
      entity: 'income',
      id,
      payload: localIncomeToCreateWire(stream),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateIncome(
  id: string,
  patch: Partial<IncomeDraft>,
): Promise<void> {
  const existing = await db.incomeStreams.get(id)
  if (!existing) return
  const stream: LocalIncomeStream = {
    ...existing,
    label: patch.label ?? existing.label,
    amount: patch.amount ?? existing.amount,
    currency: patch.currency ?? existing.currency,
    frequency: patch.frequency ?? existing.frequency,
    day: patch.day ?? existing.day,
    color: patch.color ?? existing.color,
    walletId: patch.walletId !== undefined ? patch.walletId : existing.walletId,
    anchorDate:
      patch.anchorDate !== undefined
        ? patch.anchorDate
        : (existing.anchorDate ?? null),
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await db.incomeStreams.put(stream)
    await enqueueUpsert(
      'income',
      id,
      stream.version,
      localIncomeToCreateWire(stream),
      localIncomeToUpdateWire(stream),
    )
  })
  schedulePush()
}

export async function deleteIncome(id: string): Promise<void> {
  await deleteRecord('income', id, db.incomeStreams)
  await forgetMainIncomeStream(id)
}

// --- Goals ---------------------------------------------------------------------------

export async function createGoal(draft: GoalDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const goal: LocalGoal = {
    id,
    name: draft.name,
    kind: draft.kind,
    currency: draft.currency,
    color: draft.color,
    position: await nextGoalPosition(),
    ...kindShape(draft),
    plannedAt: null,
    planAmount: null,
    planCount: null,
    planStart: null,
    setAsideDay: draft.setAsideDay ?? null,
    payOnDue: draft.kind === 'onetime' && (draft.payOnDue ?? false),
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.put(goal)
    await db.outbox.add({
      op: 'create',
      entity: 'goal',
      id,
      payload: localGoalToCreateWire(goal),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return id
}

export async function updateGoal(id: string, draft: GoalDraft): Promise<void> {
  const existing = await db.goals.get(id)
  if (!existing) return
  // kind is immutable once created; keep the stored kind and reshape against it.
  const goal: LocalGoal = {
    ...existing,
    name: draft.name,
    currency: draft.currency,
    color: draft.color,
    ...kindShape({ ...draft, kind: existing.kind }),
    setAsideDay:
      draft.setAsideDay !== undefined
        ? draft.setAsideDay
        : existing.setAsideDay,
    payOnDue:
      existing.kind === 'onetime' && (draft.payOnDue ?? existing.payOnDue),
    updatedAt: now(),
    dirty: 1,
  }
  await persistGoal(goal)
  if (changesPlan(existing, goal)) requestPlanRecalc(id)
}

/** Record the plan the planner just wrote for this goal (no-op for a vanished goal). */
export async function setGoalPlanSnapshot(
  id: string,
  snapshot: GoalPlanSnapshot,
): Promise<void> {
  const existing = await db.goals.get(id)
  if (!existing || existing.deleted !== 0) return
  await persistGoal({ ...existing, ...snapshot, updatedAt: now(), dirty: 1 })
}

const PLAN_FIELDS = [
  'currency',
  'amount',
  'target',
  'saved',
  'frequency',
  'customInterval',
  'customUnit',
  'nextDue',
  'dueDate',
  'setAsideDay',
  'payOnDue',
] as const satisfies ReadonlyArray<keyof LocalGoal>

/** Name / colour / position edits leave the stored plan alone; these rewrite it. */
export const changesPlan = (before: LocalGoal, after: LocalGoal): boolean =>
  // A row stored before a field existed lacks it, which reads the same as null.
  PLAN_FIELDS.some(
    (field) => (before[field] ?? null) !== (after[field] ?? null),
  )

/** Edit only a goal's due/next-due date (the card's inline date picker). */
export async function setGoalDate(id: string, iso: string): Promise<void> {
  const existing = await db.goals.get(id)
  if (!existing || !iso) return
  const goal: LocalGoal = {
    ...existing,
    nextDue: existing.kind === 'onetime' ? existing.nextDue : iso,
    dueDate: existing.kind === 'onetime' ? iso : existing.dueDate,
    updatedAt: now(),
    dirty: 1,
  }
  await persistGoal(goal)
  if (changesPlan(existing, goal)) requestPlanRecalc(id)
}

/**
 * Swap two goals' priority positions. The list passes the *visible* neighbor's id, so a reorder
 * only ever acts on the goals the user can see — completed goals (which the active plan hides) are
 * never silently swapped in. Income fills top-down by position.
 */
export async function swapGoalPositions(
  id: string,
  neighborId: string,
): Promise<void> {
  const a = await db.goals.get(id)
  const b = await db.goals.get(neighborId)
  if (!a || !b || a.deleted !== 0 || b.deleted !== 0) return
  const swapped = [
    { ...a, position: b.position, updatedAt: now(), dirty: 1 as const },
    { ...b, position: a.position, updatedAt: now(), dirty: 1 as const },
  ]
  await db.transaction('rw', db.goals, db.outbox, async () => {
    for (const g of swapped) {
      await db.goals.put(g)
      await enqueueUpsert(
        'goal',
        g.id,
        g.version,
        localGoalToCreateWire(g),
        localGoalToUpdateWire(g),
      )
    }
  })
  schedulePush()
}

export async function deleteGoal(id: string): Promise<void> {
  await deleteRecord('goal', id, db.goals)
}

// --- Goal allocations (sourced reserves) ---------------------------------------------

export type AllocationDraft = {
  goalId: string
  source: AllocationSource
  walletId: string | null
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  /** When it was set aside; a new reservation defaults to today, an edit keeps its date. */
  date?: string
  /** The planned set-aside it settles. Undefined on update leaves the link alone. */
  plannedId?: string | null
}

const liveAllocations = async (): Promise<LocalGoalAllocation[]> =>
  (await db.goalAllocations.toArray()).filter((a) => a.deleted === 0)

async function nextAllocationPosition(goalId: string): Promise<number> {
  return (
    (await liveAllocations())
      .filter((a) => a.goalId === goalId)
      .reduce((m, a) => Math.max(m, a.position), -1) + 1
  )
}

/** Normalize a draft so a wallet reserve never keeps a label and vice-versa. */
function allocationShape(
  draft: AllocationDraft,
): Pick<LocalGoalAllocation, 'source' | 'walletId' | 'externalLabel'> {
  return draft.source === 'wallet'
    ? { source: 'wallet', walletId: draft.walletId, externalLabel: null }
    : { source: 'external', walletId: null, externalLabel: draft.externalLabel }
}

export async function createAllocation(
  draft: AllocationDraft,
): Promise<string> {
  const id = newId()
  const ts = now()
  const allocation: LocalGoalAllocation = {
    id,
    goalId: draft.goalId,
    ...allocationShape(draft),
    amount: draft.amount,
    currency: draft.currency,
    note: draft.note,
    position: await nextAllocationPosition(draft.goalId),
    date: draft.date ?? ymd(startOfToday()),
    plannedId: draft.plannedId ?? null,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
    await db.goalAllocations.put(allocation)
    await db.outbox.add({
      op: 'create',
      entity: 'allocation',
      id,
      payload: localAllocationToCreateWire(allocation),
      baseVersion: null,
      createdAt: ts,
    })
  })
  await closeCovered([allocation.plannedId])
  schedulePush()
  return id
}

export async function updateAllocation(
  id: string,
  draft: AllocationDraft,
): Promise<void> {
  const existing = await db.goalAllocations.get(id)
  if (!existing) return
  const allocation: LocalGoalAllocation = {
    ...existing,
    ...allocationShape(draft),
    amount: draft.amount,
    currency: draft.currency,
    note: draft.note,
    date: draft.date ?? existing.date,
    plannedId:
      draft.plannedId !== undefined ? draft.plannedId : existing.plannedId,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.goalAllocations, db.outbox, async () => {
    await db.goalAllocations.put(allocation)
    await enqueueUpsert(
      'allocation',
      id,
      allocation.version,
      localAllocationToCreateWire(allocation),
      localAllocationToUpdateWire(allocation),
    )
  })
  await reopenUnderSettled([existing.plannedId])
  await closeCovered([allocation.plannedId])
  schedulePush()
}

export async function deleteAllocation(id: string): Promise<void> {
  const plannedId = (await db.goalAllocations.get(id))?.plannedId
  await deleteRecord('allocation', id, db.goalAllocations)
  await reopenUnderSettled([plannedId])
  schedulePush()
}

// --- Shared helpers ------------------------------------------------------------------

/** The money/date fields a kind uses, with the rest nulled — mirrors the backend's shaping. */
function kindShape(
  draft: GoalDraft,
): Pick<
  LocalGoal,
  | 'amount'
  | 'target'
  | 'saved'
  | 'frequency'
  | 'customInterval'
  | 'customUnit'
  | 'nextDue'
  | 'dueDate'
> {
  const saved = draft.saved
  const noRepeat = { frequency: null, customInterval: null, customUnit: null }
  if (draft.kind === 'onetime') {
    return {
      amount: null,
      target: draft.target,
      saved,
      ...noRepeat,
      nextDue: null,
      dueDate: draft.dueDate,
    }
  }
  if (draft.kind === 'openended') {
    return {
      amount: draft.amount,
      target: draft.target,
      saved,
      ...noRepeat,
      nextDue: null,
      dueDate: null,
    }
  }
  return {
    amount: draft.amount,
    target: null,
    saved,
    ...repeatShape(draft),
    nextDue: draft.nextDue,
    dueDate: null,
  }
}

function repeatShape(
  draft: GoalDraft,
): Pick<LocalGoal, 'frequency' | 'customInterval' | 'customUnit'> {
  const custom = draft.frequency === 'custom'
  return {
    frequency: draft.frequency,
    customInterval: custom ? (draft.customInterval ?? null) : null,
    customUnit: custom ? (draft.customUnit ?? null) : null,
  }
}

async function persistGoal(goal: LocalGoal): Promise<void> {
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.put(goal)
    await enqueueUpsert(
      'goal',
      goal.id,
      goal.version,
      localGoalToCreateWire(goal),
      localGoalToUpdateWire(goal),
    )
  })
  schedulePush()
}

async function deleteRecord(
  entity: 'income' | 'goal' | 'allocation',
  id: string,
  table: typeof db.incomeStreams | typeof db.goals | typeof db.goalAllocations,
): Promise<void> {
  const entries = await pending(entity, id).toArray()
  const neverSynced = entries.some((e) => e.op === 'create')
  await db.transaction('rw', table, db.outbox, async () => {
    await pending(entity, id).delete()
    await table.delete(id)
    // Only tell the server to delete a row it has actually seen.
    if (!neverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity,
        id,
        payload: null,
        baseVersion: null,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}
