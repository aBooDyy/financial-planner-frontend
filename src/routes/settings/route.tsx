import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { SettingsLayout } from '#/features/settings/components/SettingsLayout'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

/** The chrome every Settings pane shares. Each pane is a child route rendered in its Outlet. */
function SettingsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <SettingsLayout />
}
