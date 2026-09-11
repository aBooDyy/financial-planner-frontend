import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/')({ component: Index })

function Index() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  // Balances is the home surface once signed in.
  return <RedirectTo to="/balances" />
}
