import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { GoalsPage } from '#/features/goals/components/GoalsPage'
import { useSessionStore } from '#/stores/session'

export type GoalsSearch = {
  /** `?goal=<id>` — open that goal's detail (a Balances pot links here). */
  goal?: string
}

export const Route = createFileRoute('/goals')({
  component: GoalsRoute,
  validateSearch: (search: Record<string, unknown>): GoalsSearch =>
    typeof search.goal === 'string' && search.goal ? { goal: search.goal } : {},
})

function GoalsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <GoalsPage />
}
