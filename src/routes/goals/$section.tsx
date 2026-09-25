import { createFileRoute, redirect } from '@tanstack/react-router'
import { GoalsPage } from '#/features/goals/components/GoalsPage'
import { isGoalsSection } from '#/features/goals/components/sections'

export const Route = createFileRoute('/goals/$section')({
  component: GoalsPage,
  beforeLoad: ({ params, search }) => {
    if (!isGoalsSection(params.section))
      throw redirect({
        to: '/goals/$section',
        params: { section: 'summary' },
        search,
        replace: true,
      })
  },
})
