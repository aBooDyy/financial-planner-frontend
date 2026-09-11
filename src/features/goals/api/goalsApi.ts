import { http } from '#/lib/http'
import type {
  CreateGoalWire,
  CreateIncomeWire,
  Goal,
  GoalWire,
  IncomeStream,
  IncomeStreamWire,
  UpdateGoalWire,
  UpdateIncomeWire,
} from './types'
import { toGoal, toIncome } from './types'

/**
 * Remote calls for the Goals planning entities (income streams + goals). The sync engine owns
 * when these run; UI code reads from the local DB, never from here directly.
 */
export const goalsApi = {
  listIncome: (): Promise<IncomeStream[]> =>
    http
      .get<IncomeStreamWire[]>('/income-streams')
      .then((rows) => rows.map(toIncome)),

  createIncome: (payload: CreateIncomeWire): Promise<IncomeStream> =>
    http.post<IncomeStreamWire>('/income-streams', payload).then(toIncome),

  updateIncome: (
    id: string,
    payload: UpdateIncomeWire,
  ): Promise<IncomeStream> =>
    http
      .patch<IncomeStreamWire>(`/income-streams/${id}`, payload)
      .then(toIncome),

  deleteIncome: (id: string): Promise<void> =>
    http.del<void>(`/income-streams/${id}`).then(() => undefined),

  listGoals: (): Promise<Goal[]> =>
    http.get<GoalWire[]>('/goals').then((rows) => rows.map(toGoal)),

  createGoal: (payload: CreateGoalWire): Promise<Goal> =>
    http.post<GoalWire>('/goals', payload).then(toGoal),

  updateGoal: (id: string, payload: UpdateGoalWire): Promise<Goal> =>
    http.patch<GoalWire>(`/goals/${id}`, payload).then(toGoal),

  deleteGoal: (id: string): Promise<void> =>
    http.del<void>(`/goals/${id}`).then(() => undefined),
}
