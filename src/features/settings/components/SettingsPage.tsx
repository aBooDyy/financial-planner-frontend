import { useEffect, useState } from 'react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { startSync } from '#/db/sync'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { useBalances } from '#/features/balances/hooks/useBalances'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import { EmailSyncSection } from '#/features/email-sync/components/EmailSyncSection'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { AccountSection } from './AccountSection'
import { CategoriesSection } from './CategoriesSection'
import { CurrenciesSection } from './CurrenciesSection'
import { DataSection } from './DataSection'
import { NotificationsSection } from './NotificationsSection'
import { PreferencesSection } from './PreferencesSection'
import { SettingsRail } from './SettingsRail'
import type { SectionKey } from './SettingsRail'

export function SettingsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { base, rateRows, nodes } = useBalances()
  const [section, setSection] = useState<SectionKey>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('section') === 'email'
      ? 'email'
      : 'account',
  )

  useEffect(() => startSync(), [])

  if (!user) return null

  const wallets = nodes
    .filter((n) => n.kind === 'wallet')
    .map((n) => ({ id: n.id, name: n.name }))
  const signOut = () => void logout()

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={signOut}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 gap-4 px-[14px] py-4 pb-[30px] md:max-w-[1180px] md:grid-cols-[230px_minmax(0,1fr)] md:items-start md:gap-[30px] md:px-6 md:py-[26px] md:pb-[90px]">
          <SettingsRail active={section} onSelect={setSection} />

          <div className="min-w-0">
            {section === 'account' ? <AccountSection user={user} /> : null}
            {section === 'prefs' ? (
              <PreferencesSection
                base={base}
                onBaseChange={(code) => void setBaseCurrency(code)}
                wallets={wallets}
              />
            ) : null}
            {section === 'currency' ? (
              <CurrenciesSection base={base} rates={rateRows} />
            ) : null}
            {section === 'categories' ? <CategoriesSection /> : null}
            {section === 'email' ? <EmailSyncSection /> : null}
            {section === 'notif' ? <NotificationsSection /> : null}
            {section === 'data' ? <DataSection onSignOut={signOut} /> : null}
          </div>
        </div>
      </div>

      <MobileTabBar />
    </div>
  )
}
