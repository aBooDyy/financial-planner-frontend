import { Plus, Repeat } from 'lucide-react'
import type { GoalsView } from '#/features/goals/data/selectors'
import { Button } from '#/components/ui/button'
import { CompletedGoalRow } from './CompletedGoalRow'
import { GoalCard } from './GoalCard'

type Props = {
  view: GoalsView
  onAddGoal: () => void
  onAddObligation: () => void
  // Swap a goal with the given visible neighbor (the list owns the neighbor lookup so reordering
  // never targets a completed goal that's hidden from the active plan).
  onReorder: (id: string, neighborId: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDateChange: (id: string, iso: string) => void
}

export function GoalsListCard({
  view,
  onAddGoal,
  onAddObligation,
  onReorder,
  onEdit,
  onDelete,
  onDateChange,
}: Props) {
  const { goalCards, completedGoals } = view
  const isEmpty = goalCards.length === 0 && completedGoals.length === 0

  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Goals &amp; obligations</span>
          <span className="text-[12px] text-fp-text-3">
            {view.totalCount} {view.totalCount === 1 ? 'item' : 'items'} ·
            funded by due date, then priority
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onAddObligation}
            className="gap-[5px] px-3 py-[9px] text-[13px] font-semibold hover:border-fp-accent"
          >
            <Repeat size={15} strokeWidth={2} />
            Obligation
          </Button>
          <Button
            onClick={onAddGoal}
            className="gap-[5px] px-[13px] py-[9px] text-[13px]"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add goal
          </Button>
        </div>
      </div>

      <div className="p-[10px]">
        {isEmpty ? (
          <div className="px-3 py-6 text-[13px] text-fp-text-3">
            Add a goal or obligation and the plan will work out what to set
            aside each month.
          </div>
        ) : (
          <>
            {goalCards.map((card, i) => (
              <GoalCard
                key={card.id}
                card={card}
                onUp={() => {
                  if (i > 0) onReorder(card.id, goalCards[i - 1].id)
                }}
                onDown={() => {
                  if (i < goalCards.length - 1)
                    onReorder(card.id, goalCards[i + 1].id)
                }}
                onEdit={onEdit}
                onDelete={onDelete}
                onDateChange={onDateChange}
              />
            ))}

            {completedGoals.length > 0 ? (
              <>
                <div className="mt-1 mb-[9px] px-1 text-[11px] font-bold tracking-[0.03em] text-fp-text-3 uppercase">
                  Completed · fully saved
                </div>
                {completedGoals.map((goal) => (
                  <CompletedGoalRow
                    key={goal.id}
                    goal={goal}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
