import { createFileRoute, redirect } from '@tanstack/react-router'

/** Goals always shows a section, so the bare path resolves to the first one. */
export const Route = createFileRoute('/goals/')({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/goals/$section',
      params: { section: 'summary' },
      search,
      replace: true,
    })
  },
})
