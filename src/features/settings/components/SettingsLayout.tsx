import { Outlet } from '@tanstack/react-router'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/wallets/data/mutations'
import { useWallets } from '#/features/wallets/hooks/useWallets'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { SettingsRail } from './SettingsRail'

/**
 * The chrome around every Settings pane. Each pane is its own route, so the rail is a set of
 * links and the browser's own history is what moves between them.
 */
export function SettingsLayout() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { base } = useWallets()

  if (!user) return null

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 gap-4 px-[14px] py-4 pb-[30px] md:max-w-[1180px] md:grid-cols-[230px_minmax(0,1fr)] md:items-start md:gap-[30px] md:px-6 md:py-[26px] md:pb-[90px]">
          <SettingsRail />
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>

      <MobileTabBar />
    </div>
  )
}
