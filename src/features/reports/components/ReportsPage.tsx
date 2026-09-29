import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { ScopeSelect } from '#/features/transactions/components/ScopeSelect'
import { useReport } from '#/features/reports/hooks/useReport'
import { useReportControls } from '#/features/reports/hooks/useReportControls'
import { useSessionStore } from '#/stores/session'
import { CategoryBreakdownCard } from './CategoryBreakdownCard'
import { LargestExpensesCard } from './LargestExpensesCard'
import { RangeControls } from './RangeControls'
import { ReportsHeader } from './ReportsHeader'
import { SummaryCards } from './SummaryCards'
import { TrendCard } from './TrendCard'

export function ReportsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const controls = useReportControls()
  const { range, today, view, sections, scope, balancesLoading } =
    useReport(controls)

  if (!user) return null

  const scopePicker = (compact: boolean) => (
    <ScopeSelect
      sections={sections}
      balancesLoading={balancesLoading}
      value={scope}
      onChange={controls.setScope}
      compact={compact}
    />
  )

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav user={user} active="reports" onSignOut={() => void logout()} />

      <div className="flex-1 overflow-auto">
        <span role="status" className="sr-only">
          {view ? '' : 'Loading your report…'}
        </span>
        <div
          aria-busy={!view}
          className="mx-auto flex w-full max-w-[560px] flex-col gap-[14px] px-[14px] py-[14px] pb-[30px] md:max-w-[1180px] md:gap-[18px] md:px-6 md:py-[26px] md:pb-[90px]"
        >
          <ReportsHeader trailing={scopePicker(false)} />
          <RangeControls
            controls={controls}
            range={range}
            today={today}
            scopePicker={scopePicker(true)}
          />
          <SummaryCards view={view?.summary ?? null} />
          <TrendCard
            trend={view?.trend ?? null}
            balance={view?.balance ?? null}
            partial={range.partial}
          />
          <div className="grid grid-cols-1 items-start gap-[14px] md:grid-cols-[minmax(0,1fr)_360px] md:gap-[18px]">
            <CategoryBreakdownCard breakdown={view?.breakdown ?? null} />
            <LargestExpensesCard
              items={view?.largest ?? null}
              partial={range.partial}
            />
          </div>
        </div>
      </div>

      <MobileTabBar active="reports" />
    </div>
  )
}
