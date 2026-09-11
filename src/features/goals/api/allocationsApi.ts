import { http } from '#/lib/http'
import type {
  CreateGoalAllocationWire,
  GoalAllocation,
  GoalAllocationWire,
  UpdateGoalAllocationWire,
} from './types'
import { toAllocation } from './types'

/**
 * Remote calls for goal allocations (the sourced reserves behind each goal's saved progress).
 * The sync engine owns when these run; UI code reads from the local DB, never from here.
 */
export const allocationsApi = {
  list: (): Promise<GoalAllocation[]> =>
    http
      .get<GoalAllocationWire[]>('/goal-allocations')
      .then((rows) => rows.map(toAllocation)),

  create: (payload: CreateGoalAllocationWire): Promise<GoalAllocation> =>
    http
      .post<GoalAllocationWire>('/goal-allocations', payload)
      .then(toAllocation),

  update: (
    id: string,
    payload: UpdateGoalAllocationWire,
  ): Promise<GoalAllocation> =>
    http
      .patch<GoalAllocationWire>(`/goal-allocations/${id}`, payload)
      .then(toAllocation),

  del: (id: string): Promise<void> =>
    http.del<void>(`/goal-allocations/${id}`).then(() => undefined),
}
