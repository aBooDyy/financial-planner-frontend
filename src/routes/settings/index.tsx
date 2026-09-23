import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Settings always shows a pane, so the bare path resolves to the first one. `beforeLoad`
 * redirects before the layout paints, so no one ever sees an empty Outlet.
 */
export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/account', replace: true })
  },
})
