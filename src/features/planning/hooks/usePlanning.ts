import { useMemo } from 'react'
import type { CurrencyCode } from '#/lib/currency'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { FundingPlan } from '#/features/planning/data/funding'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import {
  eachPaycheck,
  needsDecision,
  verdictOf,
} from '#/features/planning/data/paycheck'
import type {
  Decision,
  EachPaycheck,
  Verdict,
} from '#/features/planning/data/paycheck'
import { reviewCount, waitingReviews } from '#/features/planning/data/review'
import type { PaydayReview } from '#/features/planning/data/review'
import { billStatuses, goalStatuses } from '#/features/planning/data/status'
import type { BillStatus, GoalStatus } from '#/features/planning/data/status'
import { buildUpcoming } from '#/features/planning/data/upcoming'
import type { UpcomingView } from '#/features/planning/data/upcoming'

export type PlanningView = {
  loading: boolean
  /** ISO date the view is computed for. */
  today: string
  calendar: PayCalendar
  funding: FundingPlan
  bills: Record<string, BillStatus>
  goals: Record<string, GoalStatus>
  paycheck: EachPaycheck
  verdict: Verdict
  decisions: Decision[]
  upcoming: UpcomingView
  /** Paydays with set-asides waiting in the review queue, oldest first. */
  reviews: PaydayReview[]
  /** The "Review · N" badge. */
  reviewCount: number
}

/**
 * Everything the Planning page reads, derived from the planner's one shared read (no extra
 * table reads): bill and goal status, the Each paycheck picture and its verdict, what needs a
 * decision, Upcoming by payday and the payday review queue.
 */
export function usePlanning(): PlanningView {
  const data = usePlannedData()
  return useMemo(() => {
    const { inputs, state, today, nodes } = data
    const walletCurrency = new Map<string, CurrencyCode>(
      nodes
        .filter((n) => n.kind === 'wallet')
        .map((n) => [n.id, n.currency ?? inputs.base]),
    )
    const paycheck = eachPaycheck(inputs, state)
    const reviews = waitingReviews(inputs, state, { today, walletCurrency })
    return {
      loading: data.loading,
      today,
      calendar: state.funding.calendar,
      funding: state.funding,
      bills: billStatuses(inputs, state, today),
      goals: goalStatuses(inputs, state, today),
      paycheck,
      verdict: verdictOf(inputs, state, paycheck),
      decisions: needsDecision(state),
      upcoming: buildUpcoming({ inputs, state, nodes, today }),
      reviews,
      reviewCount: reviewCount(reviews),
    }
  }, [data])
}
