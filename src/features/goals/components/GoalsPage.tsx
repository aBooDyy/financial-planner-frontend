import { useEffect } from 'react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { startSync } from '#/db/sync'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import {
  deleteGoal,
  deleteIncome,
  setGoalDate,
  swapGoalPositions,
} from '#/features/goals/data/mutations'
import { useGoals } from '#/features/goals/hooks/useGoals'
import { useGoalEditor } from '#/features/goals/hooks/useGoalEditor'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { GoalEditor } from './GoalEditor'
import { GoalsListCard } from './GoalsListCard'
import { IncomeCard } from './IncomeCard'
import { MonthlyPlanCard } from './MonthlyPlanCard'
import { PlanHeroCard } from './PlanHeroCard'
import { TimelineCard } from './TimelineCard'
import { VerdictCard } from './VerdictCard'

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

  useEffect(() => startSync(), [])

  if (!user) return null

  const editIncome = (id: string) => {
    const stream = income.find((s) => s.id === id)
    if (stream) editor.openEditIncome(stream)
  }
  const editGoal = (id: string) => {
    const goal = goals.find((g) => g.id === id)
    if (goal) editor.openEditGoal(goal)
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        active="goals"
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 items-start gap-4 px-[14px] py-4 pb-[30px] md:max-w-[1180px] md:grid-cols-[minmax(0,1fr)_340px] md:gap-6 md:px-6 md:py-[26px] md:pb-[90px]">
          <div className="flex min-w-0 flex-col gap-4">
            <PlanHeroCard view={view} />
            <IncomeCard
              view={view}
              onAdd={editor.openAddIncome}
              onEdit={editIncome}
              onDelete={(id) => void deleteIncome(id)}
            />
            <GoalsListCard
              view={view}
              onAddGoal={() => editor.openAddGoal('onetime')}
              onAddObligation={() => editor.openAddGoal('recurring')}
              onReorder={(id, neighborId) =>
                void swapGoalPositions(id, neighborId)
              }
              onEdit={editGoal}
              onDelete={(id) => void deleteGoal(id)}
              onDateChange={(id, iso) => void setGoalDate(id, iso)}
            />
            <MonthlyPlanCard view={view} />
          </div>

          <div className="flex flex-col gap-4">
            <VerdictCard view={view} />
            <TimelineCard view={view} />
          </div>
        </div>
      </div>

      <MobileTabBar active="goals" />

      {editor.editing ? (
        <GoalEditor
          editing={editor.editing}
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
  )
}
