import {
  CalendarDays,
  Check,
  PiggyBank,
  Repeat,
  SquarePen,
  Target,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GoalKind } from '#/features/goals/api/types'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { CompletedGoal } from '#/features/goals/data/selectors'
import { Button } from '#/components/ui/button'

const KIND_ICON: Record<GoalKind, LucideIcon> = {
  onetime: Target,
  recurring: Repeat,
  openended: PiggyBank,
  sinking: CalendarDays,
}

const ICON_BTN =
  'h-7 w-7 rounded-[8px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text'

type Props = {
  goal: CompletedGoal
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

// A fully-saved goal, kept in the list (dimmed, no priority controls) so it never looks deleted.
export function CompletedGoalRow({ goal, onEdit, onDelete }: Props) {
  const green = STATUS_COLORS.green
  const Icon = KIND_ICON[goal.kind]

  return (
    <div className="mb-[9px] flex items-center gap-[11px] rounded-[14px] border border-fp-border bg-fp-surface-2 p-[13px] last:mb-0">
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `${goal.color}22`, color: goal.color }}
      >
        <Icon size={17} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="text-[14.5px] font-bold">{goal.name}</span>
          <span className="rounded-full border border-fp-border bg-fp-surface px-2 py-[2px] text-[10.5px] font-bold tracking-[0.03em] text-fp-text-2 uppercase">
            {goal.kindLabel}
          </span>
        </div>
        <div className="mt-[3px] text-[12px] text-fp-text-3">{goal.metaStr}</div>
      </div>

      <span
        className="inline-flex shrink-0 items-center gap-[5px] rounded-full px-2 py-[2px] text-[11px] font-bold"
        style={{ color: green.main, background: green.soft }}
      >
        <Check size={12} strokeWidth={2.6} />
        Completed
      </span>

      <div className="flex flex-col gap-px">
        <Button
          variant="ghost"
          size="icon"
          title="Edit"
          onClick={() => onEdit(goal.id)}
          className={ICON_BTN}
        >
          <SquarePen size={14} strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Delete"
          onClick={() => onDelete(goal.id)}
          className={`${ICON_BTN} hover:!text-fp-danger`}
        >
          <Trash2 size={14} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  )
}
