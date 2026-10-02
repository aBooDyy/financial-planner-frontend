import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { BillDetail } from './BillDetail'
import { GoalDetail } from './GoalDetail'

/** The open bill's or goal's detail panel, if any. */
export function DetailHost() {
  const detail = usePlanningUi((s) => s.detail)
  const close = usePlanningUi((s) => s.closeDetail)
  if (!detail) return null
  return detail.kind === 'bill' ? (
    <BillDetail key={detail.id} billId={detail.id} onClose={close} />
  ) : (
    <GoalDetail key={detail.id} goalId={detail.id} onClose={close} />
  )
}
