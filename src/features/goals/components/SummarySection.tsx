import type { GoalsView } from '#/features/goals/data/selectors'
import { DecisionsCard } from './DecisionsCard'
import { MonthlyLedgerCard } from './MonthlyLedgerCard'
import { PriorityCard } from './PriorityCard'
import { RecalcAllCard } from './RecalcAllCard'
import { SummaryVerdictCard } from './SummaryVerdictCard'
import { UpcomingCard } from './UpcomingCard'

type Props = {
  view: GoalsView
  primaryLabel: string
  selectedGoalId: string | null
  onPrimary: () => void
  onSeeTimeline: () => void
  onOpenGoal: (id: string) => void
}

// Three questions in order: does the month balance, what gets funded first, and what actually
// moves next.
export function SummarySection({
  view,
  primaryLabel,
  selectedGoalId,
  onPrimary,
  onSeeTimeline,
  onOpenGoal,
}: Props) {
  const { summary } = view
  return (
    <div className="flex flex-col gap-[14px]">
      <SummaryVerdictCard
        verdict={view.verdict}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        onSeeTimeline={onSeeTimeline}
      />
      <RecalcAllCard />
      <MonthlyLedgerCard
        rows={summary.ledger}
        net={summary.ledgerNet}
        usageStr={summary.usageStr}
      />
      {summary.priority.length > 0 ? (
        <PriorityCard
          rows={summary.priority}
          note={summary.priorityNote}
          selectedId={selectedGoalId}
          onOpen={onOpenGoal}
        />
      ) : null}
      {summary.decisions.length > 0 ? (
        <DecisionsCard decisions={summary.decisions} onOpen={onOpenGoal} />
      ) : null}
      <UpcomingCard events={summary.upcoming} />
    </div>
  )
}
