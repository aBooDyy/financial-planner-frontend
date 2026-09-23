import { Check } from 'lucide-react'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { CompletedGoal } from '#/features/goals/data/selectors'
import { ListRow } from './ListRow'

type Props = {
  goal: CompletedGoal
  selected: boolean
  onSelect: (id: string) => void
}

// A fully-saved goal, kept in the list (dimmed) so it never looks deleted.
export function CompletedGoalRow({ goal, selected, onSelect }: Props) {
  return (
    <ListRow
      color={goal.color}
      selected={selected}
      onSelect={() => onSelect(goal.id)}
      muted
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">
          {goal.name}
        </span>
        <span className="block truncate text-[11px] text-fp-text-3">
          {goal.metaStr}
        </span>
      </span>
      <span
        className="inline-flex flex-none items-center gap-1 text-[11px] font-bold"
        style={{ color: STATUS_COLORS.green.main }}
      >
        <Check size={12} strokeWidth={2.6} />
        Done
      </span>
    </ListRow>
  )
}
