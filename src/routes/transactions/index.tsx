import { createFileRoute, redirect } from '@tanstack/react-router'

/** Spending always shows a view, so the bare path resolves to the first one. */
export const Route = createFileRoute('/transactions/')({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/transactions/$view',
      params: { view: 'activity' },
      search,
      replace: true,
    })
  },
})
