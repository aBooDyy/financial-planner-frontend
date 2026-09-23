import { useState } from 'react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import { RECURRING_KINDS } from '#/features/goals/constants'
import { swapGoalPositions } from '#/features/goals/data/mutations'
import { useGoals } from '#/features/goals/hooks/useGoals'
import { useGoalEditor } from '#/features/goals/hooks/useGoalEditor'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { GoalEditor } from './GoalEditor'
import { GoalListSection } from './GoalListSection'
import { IncomeSection } from './IncomeSection'
import { SectionTabCard } from './SectionTabCard'
import { SectionTabs } from './SectionTabs'
import type { GoalsSection } from './sections'
import { SummarySection } from './SummarySection'
import { TimelineSection } from './TimelineSection'

export function GoalsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const {
    base,
    rates,
    income,
    goals,
    view,
    nodes,
    allocations,
    walletBalances,
  } = useGoals()
  const editor = useGoalEditor(base, nodes, allocations)
  const [section, setSection] = useState<GoalsSection>('summary')

  if (!user) return null

  const { editing } = editor
  const selectedGoalId = editing?.type === 'goal' ? editing.id : null
  const selectedIncomeId = editing?.type === 'income' ? editing.id : null
  const cardIndex = view.goalCards.findIndex((c) => c.id === selectedGoalId)
  const editingCard = cardIndex >= 0 ? view.goalCards[cardIndex] : null

  const goTo = (next: GoalsSection) => {
    editor.close()
    setSection(next)
  }
  const openGoal = (id: string) => {
    const goal = goals.find((g) => g.id === id)
    if (!goal) return
    setSection(RECURRING_KINDS.includes(goal.kind) ? 'obligations' : 'goals')
    editor.openEditGoal(goal)
  }
  const openIncome = (id: string) => {
    const stream = income.find((s) => s.id === id)
    if (stream) editor.openEditIncome(stream)
  }
  // Swap with the neighbour in the active plan, so a reorder never targets a completed goal.
  const moveEditing = (step: -1 | 1) => {
    const neighbor = view.goalCards[cardIndex + step] as
      | (typeof view.goalCards)[number]
      | undefined
    if (editingCard && neighbor)
      void swapGoalPositions(editingCard.id, neighbor.id)
  }

  const firstDecision =
    view.summary.decisions.length > 0 ? view.summary.decisions[0] : null

  // A section is flagged when it holds anything that isn't on track.
  const alerts = {
    goals: view.goalsList.groups.some((g) => g.status !== 'green'),
    obligations: view.obligationsList.groups.some((g) => g.status !== 'green'),
  }

  const content = (() => {
    switch (section) {
      case 'summary':
        return (
          <SummarySection
            view={view}
            primaryLabel={firstDecision ? 'Fix the gap' : 'Review goals'}
            selectedGoalId={selectedGoalId}
            onPrimary={() =>
              firstDecision ? openGoal(firstDecision.goalId) : goTo('goals')
            }
            onSeeTimeline={() => goTo('timeline')}
            onOpenGoal={openGoal}
          />
        )
      case 'goals':
        return (
          <GoalListSection
            title="Goals"
            list={view.goalsList}
            completed={view.completedGoals}
            addLabel="Add goal"
            emptyText="Add a goal — a target by a date, or a fund you grow each month — and the plan works out what to set aside."
            selectedId={selectedGoalId}
            onAdd={() => editor.openAddGoal('onetime')}
            onSelect={openGoal}
          />
        )
      case 'obligations':
        return (
          <GoalListSection
            title="Obligations"
            list={view.obligationsList}
            completed={[]}
            addLabel="Add obligation"
            emptyText="Add a recurring bill or cost you have to cover, and the plan sets money aside for each due date."
            selectedId={selectedGoalId}
            onAdd={() => editor.openAddGoal('recurring')}
            onSelect={openGoal}
          />
        )
      case 'income':
        return (
          <IncomeSection
            view={view}
            selectedId={selectedIncomeId}
            onAdd={editor.openAddIncome}
            onSelect={openIncome}
          />
        )
      case 'timeline':
        return <TimelineSection view={view} />
    }
  })()

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        active="goals"
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />
      <SectionTabs active={section} alerts={alerts} onSelect={goTo} />

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[780px] px-[14px] pt-4 pb-[30px] md:px-[22px] md:pt-5 md:pb-[60px]">
            <SectionTabCard
              active={section}
              counts={{
                goals: view.goalsList.count,
                obligations: view.obligationsList.count,
              }}
              alerts={alerts}
              onSelect={goTo}
            />
            {content}
          </div>
        </main>

        {editing ? (
          <GoalEditor
            editing={editing}
            card={editingCard}
            rankTotal={view.goalCards.length}
            onMoveUp={() => moveEditing(-1)}
            onMoveDown={() => moveEditing(1)}
            nodes={nodes}
            walletBalances={walletBalances}
            allocations={allocations}
            rates={rates}
            onField={editor.setField}
            onKind={editor.setKind}
            onAddAllocation={editor.addAllocationRow}
            onRemoveAllocation={editor.removeAllocationRow}
            onAllocationSource={editor.setAllocationSource}
            onAllocationField={editor.setAllocationField}
            onSave={() => void editor.save()}
            onDelete={() => void editor.remove()}
            onClose={editor.close}
          />
        ) : null}
      </div>

      <MobileTabBar active="goals" />
    </div>
  )
}
