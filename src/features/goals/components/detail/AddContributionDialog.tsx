import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import type {
  ContributionInput,
  ContributionResult,
  GoalPlanView,
} from '#/features/planned'
import { useContributionForm } from '#/features/goals/hooks/useContributionForm'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { ContributionFields } from './ContributionFields'
import { ContributionModeSwitch } from './ContributionModeSwitch'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: LocalGoal
  plan: GoalPlanView | null
  /** "SR 9,000 left · next planned Oct 1". */
  subtitle: string
  nodes: ReadonlyArray<LocalBalanceNode>
  add: (input: ContributionInput) => Promise<ContributionResult>
}

/** 1b: record money toward the goal now, or plan it for a later date. */
export function AddContributionDialog({
  open,
  onOpenChange,
  goal,
  plan,
  subtitle,
  nodes,
  add,
}: Props) {
  const f = useContributionForm({
    goal,
    plan,
    nodes,
    add,
    onDone: () => onOpenChange(false),
  })

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add to ${goal.name}`}
      description={subtitle}
      contentClassName="sm:max-w-[400px]"
      footer={
        <Button
          onClick={() => void f.submit()}
          disabled={!f.canSubmit}
          className="w-full"
        >
          {f.cta}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <ContributionModeSwitch value={f.mode} onChange={f.setMode} />
        <ContributionFields f={f} currency={goal.currency} />
        <p className="rounded-[10px] bg-fp-surface-2 px-[11px] py-[10px] text-[11.5px] leading-normal text-fp-text-2">
          {f.hint}
        </p>
        {f.error ? (
          <p role="alert" className="text-[12.5px] text-fp-danger">
            {f.error}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
