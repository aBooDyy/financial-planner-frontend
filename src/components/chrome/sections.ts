/**
 * The app's primary sections, shared by the top nav and mobile tab bar. `to` marks a section
 * that's been built and is navigable; sections without it render disabled (coming soon).
 */
export type AppSection = 'wallets' | 'budget' | 'planning' | 'reports'

export type NavSection = {
  key: AppSection
  label: string
  to?: '/wallets' | '/transactions' | '/planning' | '/reports'
}

export const NAV_SECTIONS: NavSection[] = [
  { key: 'wallets', label: 'Wallets', to: '/wallets' },
  { key: 'budget', label: 'Spending', to: '/transactions' },
  { key: 'planning', label: 'Planning', to: '/planning' },
  { key: 'reports', label: 'Reports', to: '/reports' },
]
