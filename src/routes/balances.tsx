import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { BalancesPage } from '#/features/balances/components/BalancesPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/balances')({ component: BalancesRoute })

function BalancesRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <BalancesPage />
}
