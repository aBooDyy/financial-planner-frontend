import { createFileRoute } from '@tanstack/react-router'

export type GoalsSearch = {
  /** `?goal=<id>` from an old link; it lands as `/planning/goals?open=goal:<id>`. */
  goal?: string
}

/** Goals became Planning: every `/goals` link redirects (see the child routes). */
export const Route = createFileRoute('/goals')({
  validateSearch: (search: Record<string, unknown>): GoalsSearch =>
    typeof search.goal === 'string' && search.goal ? { goal: search.goal } : {},
})
