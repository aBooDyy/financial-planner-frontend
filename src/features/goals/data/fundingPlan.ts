/**
 * The funding plan the planner generates goal set-asides from: each active goal translated
 * into a `PlanTrack` and run through the time-phased simulation (`simulatePlan`).
 *
 * Interim engine: it still funds goals by earliest deadline with position breaking ties, and
 * knows nothing of bills. The two-tier priority and bill coverage replace it.
 */
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type { FundingStatus } from '#/features/goals/constants'
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { frequencyMetaOf } from './cadence'
import { setAsidesLeft, simulatePlan, ymd } from './planning'
import type { PlanTrack, TrackPlan } from './planning'

const EPS = 1

/** One active goal with everything the simulation worked out for it. */
export type GoalPlanEntry = {
  goal: LocalGoal
  /** Saved so far (goal currency): its live set-asides plus what was used from it. */
  saved: number
  track: PlanTrack
  plan: TrackPlan
  status: FundingStatus
}

/** The live plan: what the engine makes of every goal from `today`. */
export type GoalsPlan = {
  entries: GoalPlanEntry[]
  /** Goals whose target is met — out of the plan, drawing no income. */
  completed: LocalGoal[]
  incomeMonthly: number
}

/** A dated goal saves toward its target by its date; anything else is a steady monthly draw. */
export const isDatedGoal = (g: Pick<LocalGoal, 'dueDate'>): boolean =>
  g.dueDate !== null

/** Closed and paused goals plan nothing. */
export const isPlannable = (g: Pick<LocalGoal, 'closedAt' | 'pausedAt'>) =>
  g.closedAt === null && g.pausedAt === null

/** Translate a goal into the planner's view of it (base minor units, whole months). */
function toTrack(
  g: LocalGoal,
  saved: number,
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
): PlanTrack {
  const inBase = (minor: number) => convertMinor(minor, g.currency, base, rates)
  const steady = !isDatedGoal(g)
  return {
    id: g.id,
    position: g.position,
    steady,
    monthly: steady ? inBase(g.amount ?? 0) : 0,
    remaining: steady ? 0 : Math.max(0, inBase(g.target ?? 0) - inBase(saved)),
    deadline: setAsidesLeft(g.dueDate, today),
    recurs: false,
    cycleMonths: 0,
    cycleAmount: 0,
    target: steady ? inBase(g.target ?? 0) : 0,
    saved: steady ? inBase(saved) : 0,
  }
}

function statusOf(track: PlanTrack, plan: TrackPlan): FundingStatus {
  if (track.steady) {
    if (plan.fundedNow) return 'green'
    return plan.now > EPS ? 'amber' : 'red'
  }
  if (!plan.meetsDeadline) return 'red'
  return plan.fundedNow ? 'green' : 'amber'
}

/** How far ahead to simulate: past the furthest deadline (and any open-ended target run). */
function planHorizon(tracks: ReadonlyArray<PlanTrack>): number {
  let max = 12
  for (const t of tracks) {
    if (t.steady) {
      if (t.target > EPS && t.monthly > EPS)
        max = Math.max(max, Math.ceil(t.target / t.monthly))
    } else {
      max = Math.max(max, t.deadline)
    }
  }
  return Math.min(600, max + 2)
}

/** Monthly income in base minor units; a stream that has ended adds nothing. */
const incomeMonthlyOf = (
  s: LocalIncomeStream,
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
): number =>
  s.endsOn && s.endsOn < ymd(today)
    ? 0
    : (convertMinor(s.amount, s.currency, base, rates) *
        frequencyMetaOf(s, 'monthly').perYear) /
      12

/**
 * Run the funding engine over every plannable goal. `saved` is each goal's progress so far
 * (goal currency, minor units); a goal whose target is met leaves the plan.
 */
export function planGoals(
  income: ReadonlyArray<LocalIncomeStream>,
  goals: ReadonlyArray<LocalGoal>,
  base: CurrencyCode,
  rates: RatesMap,
  today: Date,
  saved: Readonly<Record<string, number>> = {},
): GoalsPlan {
  const savedOf = (g: LocalGoal) => saved[g.id] ?? 0
  const isComplete = (g: LocalGoal) =>
    (g.target ?? 0) > 0 && savedOf(g) >= (g.target ?? 0)
  const plannable = goals.filter(isPlannable)
  const ordered = plannable
    .filter((g) => !isComplete(g))
    .sort((a, b) => a.position - b.position)
  const incomeMonthly = income.reduce(
    (sum, s) => sum + incomeMonthlyOf(s, base, rates, today),
    0,
  )
  const tracks = ordered.map((g) => toTrack(g, savedOf(g), base, rates, today))
  const plans = new Map(
    simulatePlan(tracks, incomeMonthly, planHorizon(tracks)).map((p) => [
      p.id,
      p,
    ]),
  )
  return {
    entries: ordered.map((goal, i) => {
      const track = tracks[i]
      const plan = plans.get(goal.id) as TrackPlan
      return {
        goal,
        saved: savedOf(goal),
        track,
        plan,
        status: statusOf(track, plan),
      }
    }),
    completed: plannable.filter(isComplete),
    incomeMonthly,
  }
}
