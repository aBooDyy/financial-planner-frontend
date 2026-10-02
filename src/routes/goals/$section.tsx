import { createFileRoute, redirect } from '@tanstack/react-router'
import { goalsRedirect } from '#/features/planning/data/goalsRedirect'

/** An old Goals section lands on its Planning section. */
export const Route = createFileRoute('/goals/$section')({
  beforeLoad: ({ params, search }) => {
    const { section, open } = goalsRedirect(params.section, search.goal)
    throw redirect({
      to: '/planning/$section',
      params: { section },
      search: open ? { open } : {},
      replace: true,
    })
  },
})
