import { useNavigate } from '@tanstack/react-router'
import { ArrowUp, ChevronRight, ReceiptText, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { cn } from '#/lib/utils'
import type { GoalPreset } from '#/features/planning/stores/planningUi'

type Choice = 'bill' | 'goal' | 'income'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (choice: Choice) => void
  /** The one-tap Emergency fund goal, offered while the user has no goals. */
  suggestion: GoalPreset | null
  onSuggestion: (preset: GoalPreset) => void
}

const OPTIONS: ReadonlyArray<{
  key: Choice
  title: string
  sub: string
  icon: LucideIcon
  tile: string
}> = [
  {
    key: 'bill',
    title: 'A bill',
    sub: 'Rent, insurance, a car service — something you have to pay.',
    icon: ReceiptText,
    tile: 'bg-fp-surface-2 text-fp-text-2',
  },
  {
    key: 'goal',
    title: 'A goal',
    sub: 'Emergency fund, a trip, a car — something you’re saving for.',
    icon: Target,
    tile: 'bg-fp-goal-soft text-fp-goal',
  },
  {
    key: 'income',
    title: 'Income',
    sub: 'Salary or other money coming in.',
    icon: ArrowUp,
    tile: 'bg-fp-accent-soft text-fp-accent-ink',
  },
]

/** "+ Plan something": a bill, a goal or income; regular spending points to budgets. */
export function PlanChooser({
  open,
  onClose,
  onPick,
  suggestion,
  onSuggestion,
}: Props) {
  const navigate = useNavigate()
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="What are you planning for?"
      description="Pick one. You can change everything later."
    >
      <div className="flex flex-col gap-[10px]">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className="flex items-center gap-[14px] rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface px-4 py-[14px] text-start transition hover:border-fp-accent"
          >
            <span
              aria-hidden
              className={cn(
                'flex size-11 flex-none items-center justify-center rounded-[13px]',
                o.tile,
              )}
            >
              <o.icon size={21} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-fp-text">
                {o.title}
              </span>
              <span className="mt-[2px] block text-[12.5px] leading-[1.4] text-fp-text-2">
                {o.sub}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              size={18}
              className="flex-none text-fp-text-3 rtl:-scale-x-100"
            />
          </button>
        ))}
      </div>
      {suggestion ? (
        <button
          type="button"
          onClick={() => onSuggestion(suggestion)}
          className="flex items-center gap-2 self-start rounded-full border-[1.5px] border-fp-border px-[13px] py-2 text-[13px] font-bold text-fp-text transition hover:border-fp-accent"
        >
          <span aria-hidden className="size-2 rounded-full bg-fp-accent" />
          Start an emergency fund
        </button>
      ) : null}
      <p className="text-center text-[13px] text-fp-text-2">
        Regular spending like groceries?{' '}
        <button
          type="button"
          onClick={() => {
            onClose()
            void navigate({
              to: '/transactions/$view',
              params: { view: 'budgets' },
            })
          }}
          className="font-bold text-fp-accent-ink hover:underline"
        >
          Set a budget <span className="inline-block rtl:-scale-x-100">→</span>
        </button>
      </p>
    </ResponsiveDialog>
  )
}
