import { useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { useOpenFromPlanningSearch } from '#/features/planning/hooks/useOpenFromPlanningSearch'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { isPlanningSection } from '#/features/planning/sections'
import type { PlanningSection } from '#/features/planning/sections'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { useSessionStore } from '#/stores/session'
import { DetailHost } from './detail/DetailHost'
import { PlanningSheets } from './PlanningSheets'
import { SectionView } from './SectionView'
import { PlanningHeader } from './shell/PlanningHeader'
import { PlanningSectionStrip } from './shell/PlanningSectionStrip'
import { PlanningTabCard } from './shell/PlanningTabCard'
import { sectionBadges } from './shell/sectionBadges'

/** Planning: what's coming, and whether the user is ready for it (04). */
export function PlanningPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const param = useParams({ from: '/planning/$section' }).section
  const section: PlanningSection = isPlanningSection(param) ? param : 'overview'
  const planning = usePlanning()
  useOpenFromPlanningSearch(!planning.loading)
  const openSheet = usePlanningUi((s) => s.openSheet)
  const reset = usePlanningUi((s) => s.closeDetail)

  // The page's panels belong to this visit; leaving Planning closes them.
  useEffect(() => reset, [reset])

  if (!user) return null

  const badges = planning.loading
    ? {}
    : sectionBadges(planning.upcoming.dueCount, planning.decisions.length)

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav user={user} active="planning" onSignOut={() => void logout()} />
      <PlanningSectionStrip section={section} badges={badges} />
      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto">
          <span role="status" className="sr-only">
            {planning.loading ? 'Loading your plan…' : ''}
          </span>
          <div
            aria-busy={planning.loading}
            className="mx-auto flex w-full max-w-[1180px] flex-col gap-[14px] px-[14px] pt-[14px] pb-[30px] md:px-6 md:pt-[22px] md:pb-[60px]"
          >
            <PlanningHeader onPlan={() => openSheet({ kind: 'chooser' })} />
            <PlanningTabCard section={section} badges={badges} />
            <SectionView section={section} />
          </div>
        </main>
        <DetailHost />
      </div>
      <MobileTabBar active="planning" />
      <PlanningSheets />
    </div>
  )
}
