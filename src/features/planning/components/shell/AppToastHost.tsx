import { usePaydayNoticeToast } from '#/features/planning/hooks/usePaydayNoticeToast'
import { PlanningToastView } from './PlanningToastView'

/**
 * The app's one toast: mounted by the root layout so a write's confirmation — and the
 * Automatic-mode payday notice, which the planner raises on any page — shows wherever the
 * user is.
 */
export function AppToastHost() {
  usePaydayNoticeToast()
  return <PlanningToastView />
}
