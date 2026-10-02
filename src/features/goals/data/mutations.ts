/**
 * Local-first writes of income streams and goals: the Dexie row and its outbox entry in one
 * transaction, then a push. Both PATCHes are full representations, so an update always sends
 * the whole row.
 */
import { db } from '#/db/db'
import { enqueueCreate, enqueueDelete, enqueueUpsert } from '#/db/enqueue'
import { schedulePush } from '#/db/sync'
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type {
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import { goalOwner } from '#/features/planned/data/owners'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { dropSetAsidesOf } from '#/features/setAsides/data/mutations'
import { unlinkLedgerFrom } from '#/features/transactions/data/mutations'
import { forgetMainIncomeStream } from '#/features/wallets/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { newId } from '#/lib/uuid'
import {
  localGoalToCreateWire,
  localGoalToUpdateWire,
  localIncomeToCreateWire,
  localIncomeToUpdateWire,
} from './mappers'

export type IncomeDraft = {
  label: string
  amount: number
  currency: CurrencyCode
  frequency: ObligationFrequency
  /** Read only when `frequency` is 'custom'. */
  customInterval?: number | null
  customUnit?: IntervalUnit | null
  day: number
  color: string
  /** An income category; the editor defaults it to Salary. */
  categoryId: string
  walletId?: string | null
  /** A known payday. */
  anchorDate?: string | null
  endsOn?: string | null
  merchantId?: string | null
  autolog?: boolean
  note?: string | null
}

export type GoalDraft = {
  name: string
  currency: CurrencyCode
  color: string
  target: number | null
  /** Monthly amount; required when there is no `dueDate`. */
  amount: number | null
  dueDate: string | null
  mustHave?: boolean
  saveWalletId?: string | null
  useCategoryId?: string | null
  setAsideDay?: number | null
}

/** The stored plan's header, written by the planner when it (re)generates a goal's rows. */
export type GoalPlanSnapshot = Pick<
  LocalGoal,
  'plannedAt' | 'planAmount' | 'planCount' | 'planStart'
>

const now = () => new Date().toISOString()

/** Only the fields a patch actually names; `undefined` leaves the stored value. */
const definedOf = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<T>

async function nextPosition(
  table: typeof db.incomeStreams | typeof db.goals,
): Promise<number> {
  return (
    (await table.toArray())
      .filter((r) => r.deleted === 0)
      .reduce((max, r) => Math.max(max, r.position), -1) + 1
  )
}

// --- Income streams ------------------------------------------------------------------

/** The interval only rides with a custom frequency, as the server keeps it. */
function shapedIncome(s: LocalIncomeStream): LocalIncomeStream {
  const custom = s.frequency === 'custom'
  return {
    ...s,
    customInterval: custom ? s.customInterval : null,
    customUnit: custom ? s.customUnit : null,
  }
}

async function persistIncome(stream: LocalIncomeStream): Promise<void> {
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await db.incomeStreams.put(stream)
    await enqueueUpsert(
      'income',
      stream.id,
      stream.version,
      localIncomeToCreateWire(stream),
      localIncomeToUpdateWire(stream),
    )
  })
  schedulePush()
}

export async function createIncome(draft: IncomeDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const stream = shapedIncome({
    id,
    label: draft.label,
    amount: draft.amount,
    currency: draft.currency,
    frequency: draft.frequency,
    customInterval: draft.customInterval ?? null,
    customUnit: draft.customUnit ?? null,
    day: draft.day,
    anchorDate: draft.anchorDate ?? null,
    endsOn: draft.endsOn ?? null,
    color: draft.color,
    position: await nextPosition(db.incomeStreams),
    walletId: draft.walletId ?? null,
    categoryId: draft.categoryId,
    merchantId: draft.merchantId ?? null,
    autolog: draft.autolog ?? false,
    note: draft.note ?? null,
    createdAt: ts,
    updatedAt: ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  })
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await db.incomeStreams.put(stream)
    await enqueueCreate('income', id, localIncomeToCreateWire(stream))
  })
  schedulePush()
  return id
}

/** Change any of a stream's fields; the rest keep their stored values. */
export async function updateIncome(
  id: string,
  patch: Partial<IncomeDraft> & { position?: number },
): Promise<void> {
  const existing = await db.incomeStreams.get(id)
  if (!existing || existing.deleted !== 0) return
  await persistIncome(
    shapedIncome({
      ...existing,
      ...definedOf(patch),
      updatedAt: now(),
      dirty: 1,
    }),
  )
}

/**
 * Delete a stream. It stops being the main paycheck, as the server does; its planned rows are
 * left to the planner, which resolves rows whose origin is gone.
 */
export async function deleteIncome(id: string): Promise<void> {
  await db.transaction('rw', db.incomeStreams, db.outbox, async () => {
    await enqueueDelete('income', id)
    await db.incomeStreams.delete(id)
  })
  await forgetMainIncomeStream(id)
  schedulePush()
}

// --- Goals ---------------------------------------------------------------------------

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

export async function createGoal(draft: GoalDraft): Promise<string> {
  const id = newId()
  const ts = now()
  const goal: LocalGoal = {
    id,
    name: draft.name,
    currency: draft.currency,
    color: draft.color,
    position: await nextPosition(db.goals),
    target: draft.target,
    amount: draft.amount,
    dueDate: draft.dueDate,
    mustHave: draft.mustHave ?? false,
    saveWalletId: draft.saveWalletId ?? null,
    useCategoryId: draft.useCategoryId ?? null,
    closedAt: null,
    pausedAt: null,
    plannedAt: null,
    planAmount: null,
    planCount: null,
    planStart: null,
    setAsideDay: draft.setAsideDay ?? null,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await db.goals.put(goal)
    await enqueueCreate('goal', id, localGoalToCreateWire(goal))
  })
  schedulePush()
  return id
}

const PLAN_FIELDS = [
  'currency',
  'amount',
  'target',
  'dueDate',
  'mustHave',
  'saveWalletId',
] as const satisfies ReadonlyArray<keyof LocalGoal>

/** Name / colour / position edits leave the stored plan alone; these rewrite it. */
export const changesPlan = (before: LocalGoal, after: LocalGoal): boolean =>
  PLAN_FIELDS.some((field) => before[field] !== after[field])

/** Change any of a goal's fields; the rest keep their stored values. */
export async function updateGoal(
  id: string,
  patch: Partial<GoalDraft>,
): Promise<void> {
  const existing = await db.goals.get(id)
  if (!existing || existing.deleted !== 0) return
  const goal: LocalGoal = {
    ...existing,
    ...definedOf(patch),
    updatedAt: now(),
    dirty: 1,
  }
  await persistGoal(goal)
  if (changesPlan(existing, goal)) requestPlanRecalc(goalOwner(id))
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

/**
 * Swap two goals' priority positions. Callers pass the visible neighbour's id, so a reorder
 * only ever acts on goals the user can see.
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

/**
 * Delete a goal. Mirrors the server: its set-asides go with it, and spending from it keeps its
 * rows with the link cleared. Its planned rows are left to the planner, which resolves rows
 * whose origin is gone.
 */
export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.outbox, async () => {
    await enqueueDelete('goal', id)
    await db.goals.delete(id)
  })
  await dropSetAsidesOf('goalId', id)
  await unlinkLedgerFrom('goalId', id)
  schedulePush()
}
