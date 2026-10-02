import { createFileRoute, redirect } from '@tanstack/react-router'

/** Planning always shows a section, so the bare path resolves to Overview. */
export const Route = createFileRoute('/planning/')({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/planning/$section',
      params: { section: 'overview' },
      search,
      replace: true,
    })
  },
})
