/**
 * The planning engine — the public surface the Planning, Upcoming and Wallets screens import.
 */

// Hooks — reads
export { usePlanning } from './hooks/usePlanning'
export type { PlanningView } from './hooks/usePlanning'
export { useMoneyFigures } from './hooks/useMoneyFigures'
export type { MoneyFiguresView } from './hooks/useMoneyFigures'
export { useYearAhead } from './hooks/useYearAhead'

// Money actions
export { addMoney } from './actions/addMoney'
export type { AddMoneyOptions, MoneyPart } from './actions/addMoney'
export { MoneyActionError } from './actions/errors'
export type { MoneyActionCode } from './actions/errors'
export { markGoalSpent, spendFromGoal } from './actions/goalMoney'
export type { GoalSpendInput } from './actions/goalMoney'
export { resolveLeftover } from './actions/leftover'
export type { LeftoverChoice } from './actions/leftover'
export { payBill } from './actions/payBill'
export type { PayBillInput, PayBillResult } from './actions/payBill'

// Pure view models and the engine
export { balanceFigures } from './data/balances'
export type {
  BalanceFigures,
  MoneyFigures,
  WalletFigures,
} from './data/balances'
export { safeToSpend } from './data/safeToSpend'
export type { SafeLine, SafeTerm, SafeToSpend } from './data/safeToSpend'
export { billStatusOf, goalStatusOf } from './data/status'
export type {
  BillState,
  BillStatus,
  GoalState,
  GoalStatus,
  HeldLine,
  OccurrenceView,
} from './data/status'
export {
  eachPaycheck,
  needsDecision,
  TIGHT_SHARE,
  verdictOf,
} from './data/paycheck'
export type {
  Decision,
  EachPaycheck,
  PaycheckItem,
  PaycheckPart,
  Verdict,
} from './data/paycheck'
export {
  paydayReview,
  reviewCount,
  transfersFor,
  waitingReviews,
} from './data/review'
export type {
  PaydayReview,
  ReviewGroup,
  ReviewGroupKey,
  ReviewLine,
  TransferLine,
} from './data/review'
export { buildUpcoming } from './data/upcoming'
export type {
  RowCoverage,
  UpcomingPeriod,
  UpcomingRow,
  UpcomingView,
} from './data/upcoming'
export { buildYearAhead } from './data/yearAhead'
export type {
  YearAhead,
  YearBill,
  YearGoal,
  YearMonth,
  YearRamp,
  YearSetAside,
} from './data/yearAhead'
export { leftoverFor } from './data/leftover'
export type { LeftoverLine, LeftoverReport } from './data/leftover'
export {
  FALLBACK_HORIZON_DAYS,
  mainPaycheckOf,
  payCalendarOf,
  paydayAfter,
  periodOf,
  periodsBetween,
  safeHorizonEnd,
} from './data/payPeriods'
export type { PayCalendar, PayPeriod } from './data/payPeriods'
export { planFunding, tracksOf } from './data/funding'
export type {
  FundingPlan,
  FundingSlot,
  FundingTrack,
  OwnerKind,
  Tier,
  TrackPlan,
} from './data/funding'
