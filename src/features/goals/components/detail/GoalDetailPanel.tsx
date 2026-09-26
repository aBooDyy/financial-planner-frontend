import { Pencil } from 'lucide-react'
import { useState } from 'react'
import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import { collapseContributions, useGoalPlan } from '#/features/planned'
import { ConfirmPlannedDialog } from '#/features/planned/components/ConfirmPlannedDialog'
import { deleteAllocation } from '#/features/goals/data/mutations'
import { buildGoalDetail } from '#/features/goals/data/goalDetail'
import { Button } from '#/components/ui/button'
import { DetailPanel } from '../DetailPanel'
import { AddContributionDialog } from './AddContributionDialog'
import { ContributionsList } from './ContributionsList'
import { GoalProgress } from './GoalProgress'
import { PlanBox } from './PlanBox'

type Props = {
  goal: LocalGoal
  nodes: ReadonlyArray<LocalBalanceNode>
  onEdit: () => void
  onClose: () => void
}

/**
 * The selected goal, read-only (1a): progress, the stored plan against today's numbers, and
 * every contribution. The dialogs render inside the panel so, on mobile, they nest in its sheet.
 */
export function GoalDetailPanel({ goal, nodes, onEdit, onClose }: Props) {
  const plan = useGoalPlan(goal.id)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Remounts the add dialog on every opening, so it starts from a clean form.
  const [addSeq, setAddSeq] = useState(0)
  const [busy, setBusy] = useState(false)

  const view = plan.view
  const detail = view
    ? buildGoalDetail(
        goal,
        view,
        plan.lastRecalc,
        collapseContributions(view.contributions),
      )
    : null

  const run = (task: () => Promise<unknown>) => {
    setBusy(true)
    void task().finally(() => setBusy(false))
  }
  const openAdd = () => {
    setAddSeq((n) => n + 1)
    setAddOpen(true)
  }

  return (
    <DetailPanel
      title={goal.name}
      subtitle={detail?.subtitle ?? ''}
      onClose={onClose}
      footer={
        <Button
          variant="quiet"
          size="dialog"
          onClick={onEdit}
          className="flex-1 gap-[6px]"
        >
          <Pencil size={14} strokeWidth={2} />
          Edit
        </Button>
      }
    >
      {detail ? (
        <>
          <GoalProgress detail={detail} color={goal.color} />
          {detail.plan ? (
            <PlanBox
              plan={detail.plan}
              band={detail.band}
              busy={busy}
              onRecalc={() => run(plan.recalc)}
              onConfirm={setConfirmId}
              onUndo={() => {
                const last = plan.lastRecalc
                if (last) run(last.undo)
              }}
            />
          ) : null}
          <ContributionsList
            detail={detail}
            color={goal.color}
            onAdd={openAdd}
            onConfirm={setConfirmId}
            onRemoveAllocation={(id) => void deleteAllocation(id)}
          />
        </>
      ) : (
        <p className="text-[12.5px] text-fp-text-3">Loading the plan…</p>
      )}

      <AddContributionDialog
        key={addSeq}
        open={addOpen}
        onOpenChange={setAddOpen}
        goal={goal}
        plan={view}
        subtitle={detail?.addSub ?? ''}
        nodes={nodes}
        add={plan.addContribution}
      />
      <ConfirmPlannedDialog
        plannedId={confirmId}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null)
        }}
      />
    </DetailPanel>
  )
}
