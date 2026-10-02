import type { PlanningSection } from '#/features/planning/sections'
import { BillsSection } from './lists/BillsSection'
import { GoalsSection } from './lists/GoalsSection'
import { IncomeSection } from './lists/IncomeSection'

/** The section the URL names. */
export function SectionView({ section }: { section: PlanningSection }) {
  switch (section) {
    case 'bills':
      return <BillsSection />
    case 'goals':
      return <GoalsSection />
    case 'income':
      return <IncomeSection />
    default:
      return null
  }
}
