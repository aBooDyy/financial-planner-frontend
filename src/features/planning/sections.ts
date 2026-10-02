import {
  ArrowUp,
  CalendarDays,
  ChartColumn,
  ReceiptText,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** The Planning page's sections, in order; each is a `/planning/<section>` route. */
export const PLANNING_SECTIONS = [
  'overview',
  'upcoming',
  'bills',
  'goals',
  'income',
] as const

export type PlanningSection = (typeof PLANNING_SECTIONS)[number]

export const isPlanningSection = (value: string): value is PlanningSection =>
  (PLANNING_SECTIONS as readonly string[]).includes(value)

export const PLANNING_SECTION_META: Record<
  PlanningSection,
  { label: string; icon: LucideIcon }
> = {
  overview: { label: 'Overview', icon: ChartColumn },
  upcoming: { label: 'Upcoming', icon: CalendarDays },
  bills: { label: 'Bills', icon: ReceiptText },
  goals: { label: 'Goals', icon: Target },
  income: { label: 'Income', icon: ArrowUp },
}
