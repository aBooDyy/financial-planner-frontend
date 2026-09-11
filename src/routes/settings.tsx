import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { SettingsPage } from '#/features/settings/components/SettingsPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <SettingsPage />
}
