import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SessionGate } from '#/components/SessionGate'

export type GoalsSearch = {
  /** `?goal=<id>` — open that goal's detail (a Balances pot links here). */
  goal?: string
}

export const Route = createFileRoute('/goals')({
  component: GoalsRoute,
  validateSearch: (search: Record<string, unknown>): GoalsSearch =>
    typeof search.goal === 'string' && search.goal ? { goal: search.goal } : {},
})

/** The session guard every Goals section shares. Each section is a child route. */
function GoalsRoute() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}
