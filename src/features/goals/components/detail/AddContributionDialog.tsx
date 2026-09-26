import { Check } from 'lucide-react'
import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import type {
  ContributionInput,
  ContributionResult,
  GoalPlanView,
} from '#/features/planned'
import type { ContributionMode } from '#/features/goals/data/contribution'
import { useContributionForm } from '#/features/goals/hooks/useContributionForm'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldMessage } from '#/components/FormRow'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { ContributionFields } from './ContributionFields'

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

const MODES: ReadonlyArray<{ value: ContributionMode; label: string }> = [
  { value: 'now', label: 'Paid now' },
  { value: 'later', label: 'Plan for later' },
]

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
        <DialogActions
          submitLabel={f.cta}
          onSubmit={() => void f.submit()}
          disabled={!f.canSubmit}
        />
      }
    >
      <PillSwitch
        label="When"
        options={MODES}
        value={f.mode}
        onChange={f.setMode}
      />
      <AmountWell
        question="How much?"
        currency={goal.currency}
        amount={f.amount}
        onAmount={f.setAmount}
        unit="code"
        autoFocus
      />
      <ContributionFields f={f} />
      <NoteBox icon={<Check strokeWidth={2.6} />}>{f.hint}</NoteBox>
      <FieldMessage error={f.error} />
    </ResponsiveDialog>
  )
}
