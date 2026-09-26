import { useEffect } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { Receipt, Target } from 'lucide-react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/wallets/data/mutations'
import { RECURRING_KINDS } from '#/features/goals/constants'
import { swapGoalPositions } from '#/features/goals/data/mutations'
import { useGoals } from '#/features/goals/hooks/useGoals'
import { useGoalEditor } from '#/features/goals/hooks/useGoalEditor'
import { useGoalDetail } from '#/features/goals/hooks/useGoalDetail'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { GoalDetailPanel } from './detail/GoalDetailPanel'
import { DetailPanelOverlay } from './DetailPanel'
import { GoalEditor } from './GoalEditor'
import { GoalListSection } from './GoalListSection'
import { IncomeSection } from './IncomeSection'
import { SectionTabCard } from './SectionTabCard'
import { SectionTabs } from './SectionTabs'
import { isGoalsSection } from './sections'
import type { GoalsSection } from './sections'
import { SummarySection } from './SummarySection'
import { TimelineSection } from './TimelineSection'

export function GoalsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { base, income, goals, view, nodes, dueByGoal } = useGoals()
  const editor = useGoalEditor(base)
  const detail = useGoalDetail()
  const navigate = useNavigate()
  const sectionParam = useParams({ from: '/goals/$section' }).section
  const section: GoalsSection = isGoalsSection(sectionParam)
    ? sectionParam
    : 'summary'
  const linkedGoalId = useSearch({ from: '/goals' }).goal ?? null
  const linkedGoalFound =
    linkedGoalId !== null && goals.some((g) => g.id === linkedGoalId)

  const { editing } = editor
  const editingGoalId = editing?.type === 'goal' ? editing.id : null
  const selectedGoalId = editing ? editingGoalId : detail.goalId
  const selectedIncomeId = editing?.type === 'income' ? editing.id : null
  const cardIndex = view.goalCards.findIndex((c) => c.id === selectedGoalId)
  const editingCard = cardIndex >= 0 ? view.goalCards[cardIndex] : null
  const detailGoal = detail.goalId
    ? (goals.find((g) => g.id === detail.goalId) ?? null)
    : null

  const closePanel = () => {
    editor.close()
    detail.close()
  }
  const showSection = (next: GoalsSection, replace = false) =>
    void navigate({
      to: '/goals/$section',
      params: { section: next },
      search: {},
      replace,
    })
  const goTo = (next: GoalsSection) => {
    closePanel()
    showSection(next)
  }
  const openGoal = (id: string, replace = false) => {
    const goal = goals.find((g) => g.id === id)
    if (!goal) return
    showSection(
      RECURRING_KINDS.includes(goal.kind) ? 'obligations' : 'goals',
      replace,
    )
    editor.close()
    detail.open(id)
  }
  const editGoal = () => {
    if (detailGoal) editor.openEditGoal(detailGoal)
  }
  const addGoal = (kind: 'onetime' | 'recurring') => {
    detail.close()
    editor.openAddGoal(kind)
  }
  const addIncome = () => {
    detail.close()
    editor.openAddIncome()
  }
  const openIncome = (id: string) => {
    const stream = income.find((s) => s.id === id)
    if (!stream) return
    detail.close()
    editor.openEditIncome(stream)
  }
  const save = async () => {
    const savedId = await editor.save()
    if (savedId) detail.open(savedId)
  }
  const remove = async () => {
    await editor.remove()
    detail.close()
  }

  // A link from elsewhere (a Wallets pot) lands on that goal's detail, once; opening it
  // drops the param so a later close is not undone by it.
  useEffect(() => {
    if (!linkedGoalId || !linkedGoalFound) return
    openGoal(linkedGoalId, true)
    // `openGoal` is rebuilt every render; the link is what should trigger this.
  }, [linkedGoalId, linkedGoalFound])

  if (!user) return null

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
            empty={{
              icon: Target,
              title: 'No goals yet',
              text: 'Add a goal — a target by a date, or a fund you grow each month — and the plan works out what to set aside.',
            }}
            selectedId={selectedGoalId}
            dueByGoal={dueByGoal}
            onAdd={() => addGoal('onetime')}
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
            empty={{
              icon: Receipt,
              title: 'No obligations yet',
              text: 'Add a recurring bill or cost you have to cover, and the plan sets money aside for each due date.',
            }}
            selectedId={selectedGoalId}
            dueByGoal={dueByGoal}
            onAdd={() => addGoal('recurring')}
            onSelect={openGoal}
          />
        )
      case 'income':
        return (
          <IncomeSection
            view={view}
            selectedId={selectedIncomeId}
            onAdd={addIncome}
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
      <SectionTabs active={section} alerts={alerts} onNavigate={closePanel} />

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
              onNavigate={closePanel}
            />
            {content}
          </div>
        </main>

        {editing || detailGoal ? (
          <DetailPanelOverlay>
            {editing ? (
              <GoalEditor
                editing={editing}
                card={editingCard}
                rankTotal={view.goalCards.length}
                onMoveUp={() => moveEditing(-1)}
                onMoveDown={() => moveEditing(1)}
                nodes={nodes}
                onField={editor.setField}
                onKind={editor.setKind}
                onSave={() => void save()}
                onDelete={remove}
                onClose={editor.close}
              />
            ) : detailGoal ? (
              <GoalDetailPanel
                key={detailGoal.id}
                goal={detailGoal}
                nodes={nodes}
                onEdit={editGoal}
                onClose={closePanel}
              />
            ) : null}
          </DetailPanelOverlay>
        ) : null}
      </div>

      <MobileTabBar active="goals" />
    </div>
  )
}
