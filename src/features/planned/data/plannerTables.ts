/**
 * One live read of every table the planner's views derive from, shared by every mounted
 * consumer. The first subscriber opens one Dexie `liveQuery` per table; the last one to leave
 * closes them. Each table keeps its own query, so a write to one table re-reads only that
 * table, and an unchanged table keeps its array identity for the memos downstream.
 */
import { liveQuery } from 'dexie'
import type { Subscription } from 'dexie'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type {
  LocalBalanceNode,
  LocalBalanceSettings,
  LocalExchangeRate,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
  LocalPlanned,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'

/** Every table as last read; a table is undefined until its first read lands. */
export type PlannerTables = {
  goals?: LocalGoal[]
  income?: LocalIncomeStream[]
  recurrings?: LocalRecurring[]
  planned?: LocalPlanned[]
  txns?: LocalTransaction[]
  allocations?: LocalGoalAllocation[]
  nodes?: LocalBalanceNode[]
  settings?: LocalBalanceSettings | null
  rateRows?: LocalExchangeRate[]
}

const QUERIES: Record<keyof PlannerTables, () => Promise<unknown>> = {
  goals: () => db.goals.toArray(),
  income: () => db.incomeStreams.toArray(),
  recurrings: () => db.recurrings.toArray(),
  planned: () => db.plannedTransactions.toArray(),
  txns: () => db.transactions.toArray(),
  allocations: () => db.goalAllocations.toArray(),
  nodes: () => db.balanceNodes.toArray(),
  settings: async () => (await db.balanceSettings.get(SETTINGS_KEY)) ?? null,
  rateRows: () => db.exchangeRates.toArray(),
}

const NOTHING_READ: PlannerTables = {}

let snapshot: PlannerTables = NOTHING_READ
let subscriptions: Subscription[] = []
const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

function open(): void {
  subscriptions = (Object.keys(QUERIES) as Array<keyof PlannerTables>).map(
    (key) =>
      liveQuery(QUERIES[key]).subscribe({
        next: (value) => {
          snapshot = { ...snapshot, [key]: value }
          emit()
        },
        // A failed read leaves the last good value; the next change retries it.
        error: () => undefined,
      }),
  )
}

function close(): void {
  for (const s of subscriptions) s.unsubscribe()
  subscriptions = []
  snapshot = NOTHING_READ
}

/** `useSyncExternalStore`'s subscribe: opens the reads for the first consumer only. */
export function subscribePlannerTables(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) open()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) close()
  }
}

export const plannerTablesSnapshot = (): PlannerTables => snapshot

/** How many table reads are open right now — one set, however many consumers. */
export const openPlannerReads = (): number => subscriptions.length
