import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { GoalsPage } from '#/features/goals/components/GoalsPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/goals')({ component: GoalsRoute })

function GoalsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <GoalsPage />
}
