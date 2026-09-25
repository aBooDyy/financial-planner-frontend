import { Clock, PieChart, Repeat, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type GoalsSection =
  | 'summary'
  | 'goals'
  | 'obligations'
  | 'income'
  | 'timeline'

export const GOALS_SECTIONS: {
  key: GoalsSection
  label: string
  icon: LucideIcon
}[] = [
  { key: 'summary', label: 'Summary', icon: PieChart },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'obligations', label: 'Obligations', icon: Repeat },
  { key: 'income', label: 'Income', icon: Wallet },
  { key: 'timeline', label: 'Timeline', icon: Clock },
]

export const isGoalsSection = (value: string): value is GoalsSection =>
  GOALS_SECTIONS.some((s) => s.key === value)
