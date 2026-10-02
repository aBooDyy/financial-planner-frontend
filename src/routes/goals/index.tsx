import { createFileRoute, redirect } from '@tanstack/react-router'
import { goalsRedirect } from '#/features/planning/data/goalsRedirect'

/** `/goals` (and `/goals?goal=<id>`) lands on Planning. */
export const Route = createFileRoute('/goals/')({
  beforeLoad: ({ search }) => {
    const { section, open } = goalsRedirect(undefined, search.goal)
    throw redirect({
      to: '/planning/$section',
      params: { section },
      search: open ? { open } : {},
      replace: true,
    })
  },
})
