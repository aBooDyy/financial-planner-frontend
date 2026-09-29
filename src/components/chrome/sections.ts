/**
 * The app's primary sections, shared by the top nav and mobile tab bar. `to` marks a section
 * that's been built and is navigable; sections without it render disabled (coming soon).
 */
export type AppSection = 'wallets' | 'goals' | 'budget' | 'reports'

export type NavSection = {
  key: AppSection
  label: string
  to?: '/wallets' | '/goals' | '/transactions' | '/reports'
}

export const NAV_SECTIONS: NavSection[] = [
  { key: 'wallets', label: 'Wallets', to: '/wallets' },
  { key: 'goals', label: 'Goals', to: '/goals' },
  { key: 'budget', label: 'Spending', to: '/transactions' },
  { key: 'reports', label: 'Reports', to: '/reports' },
]
