import { createFileRoute, redirect } from '@tanstack/react-router'
import { PlanningPage } from '#/features/planning/components/PlanningPage'
import { isPlanningSection } from '#/features/planning/sections'

export const Route = createFileRoute('/planning/$section')({
  component: PlanningPage,
  beforeLoad: ({ params, search }) => {
    if (!isPlanningSection(params.section))
      throw redirect({
        to: '/planning/$section',
        params: { section: 'overview' },
        search,
        replace: true,
      })
  },
})
