import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SessionGate } from '#/components/SessionGate'
import {
  encodePlanningOpen,
  parsePlanningOpen,
} from '#/features/planning/data/openParam'

export type PlanningSearch = {
  /** `?open=<kind>:<id>` — open that bill, goal, income or planned item once the page has its data. */
  open?: string
}

export const Route = createFileRoute('/planning')({
  component: PlanningRoute,
  validateSearch: (search: Record<string, unknown>): PlanningSearch => {
    const open = parsePlanningOpen(search.open)
    return open ? { open: encodePlanningOpen(open) } : {}
  },
})

/** The session guard every Planning section shares. Each section is a child route. */
function PlanningRoute() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}
