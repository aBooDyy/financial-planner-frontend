/**
 * The app's primary sections, shared by the top nav and mobile tab bar. `to` marks a section
 * that's been built and is navigable; sections without it render disabled (coming soon).
 */
export type AppSection = 'balances' | 'goals' | 'budget'

export type NavSection = {
  key: AppSection
  label: string
  to?: '/balances' | '/goals' | '/transactions'
}

export const NAV_SECTIONS: NavSection[] = [
  { key: 'balances', label: 'Balances', to: '/balances' },
  { key: 'goals', label: 'Goals', to: '/goals' },
  { key: 'budget', label: 'Spending', to: '/transactions' },
]
