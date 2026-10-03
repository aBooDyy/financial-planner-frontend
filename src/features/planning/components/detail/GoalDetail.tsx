import { useMemo } from 'react'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { goalOwner } from '#/features/planned/data/owners'
import { useGoalPlan } from '#/features/planned/hooks/useGoalPlan'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { GoalStatus } from '#/features/planning/data/status'
import { useItemActions } from '#/features/planning/hooks/useItemActions'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { money, monthYear, perPeriod } from '#/features/planning/view/format'
import { historyOf } from '#/features/planning/view/history'
import { goalChip } from '#/features/planning/view/itemCopy'
import { goalPlanText } from '#/features/planning/view/planText'
import { DetailFrame } from './DetailFrame'
import { DetailActions, DetailHero, HeldIn, HistoryList } from './DetailParts'
import type { DetailAction } from './DetailParts'
import { PlanBox } from './PlanBox'

/** A goal's detail (04 §6): progress, where its money is held, its plan and its activity. */
export function GoalDetail({
  goalId,
  onClose,
}: {
  goalId: string
  onClose: () => void
}) {
  const { inputs } = usePlannedData()
  const planning = usePlanning()
  const wallets = usePlanningWallets()
  const catalog = useCategoryCatalog()
  const actions = useItemActions()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const plan = useGoalPlan(goalId)
  const goal = inputs.goals.find((g) => g.id === goalId)
  const status = planning.goals[goalId] as GoalStatus | undefined
  const history = useMemo(
    () =>
      goal
        ? historyOf({
            kind: 'goal',
            id: goal.id,
            currency: goal.currency,
            txns: inputs.txns,
            setAsides: inputs.setAsides,
            planned: inputs.planned,
            walletName: (id) =>
              id
                ? (wallets.byId.get(id)?.name ?? 'A deleted wallet')
                : 'No wallet',
            categoryName: (id) =>
              id && catalog.has(id)
                ? (catalog.pathOf(id).at(-1) ?? null)
                : null,
            rates: inputs.rates,
          })
        : [],
    [goal, inputs, wallets, catalog],
  )

  if (!goal || !status) return null
  const c = goal.currency
  const closed = goal.closedAt !== null
  const paused = goal.pausedAt !== null

  const buttons: DetailAction[] = closed
    ? [
        {
          label: 'Reopen',
          primary: true,
          onClick: () => void actions.reopen(goal, 'goal'),
        },
        {
          label: 'Edit',
          onClick: () => openSheet({ kind: 'goal', id: goal.id }),
        },
      ]
    : [
        {
          label: 'Add money',
          primary: true,
          onClick: () =>
            openSheet({ kind: 'addMoney', owner: goalOwner(goal.id) }),
        },
        {
          label: 'Use it',
          onClick: () => openSheet({ kind: 'useIt', goalId: goal.id }),
        },
        {
          label: 'Edit',
          onClick: () => openSheet({ kind: 'goal', id: goal.id }),
        },
      ]

  return (
    <DetailFrame
      color={goal.color}
      title={goal.name}
      sub={[
        goal.mustHave ? 'Must have goal' : 'Nice to have goal',
        goal.dueDate ? `by ${monthYear(goal.dueDate)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      menu={actions.goalMenu(goal)}
      onClose={onClose}
    >
      <DetailHero
        label="Saved so far"
        value={
          status.target > 0
            ? `${money(status.progress, c)} of ${money(status.target, c)}`
            : money(status.progress, c)
        }
        progress={
          status.target > 0
            ? { value: status.progress, max: status.target, color: goal.color }
            : undefined
        }
        note={
          paused
            ? 'Paused'
            : closed
              ? 'Done'
              : status.perPaycheck > 0
                ? `${money(status.perPaycheck, c)} ${perPeriod(planning.calendar)}`
                : status.used > 0
                  ? `${money(status.used, c)} used so far`
                  : 'Nothing planned this paycheck'
        }
        chip={goalChip(status, c)}
      />
      <DetailActions actions={buttons} />
      <HeldIn lines={status.heldIn} currency={c} wallets={wallets} />
      <PlanBox
        text={goalPlanText(goal, status, planning.calendar)}
        plan={closed || paused ? null : plan.view}
        currency={c}
        calendar={planning.calendar}
        today={planning.today}
        lastRecalc={plan.lastRecalc}
        onRecalc={plan.recalc}
        onDismiss={plan.dismissRecalc}
      />
      <HistoryList lines={history} />
    </DetailFrame>
  )
}
