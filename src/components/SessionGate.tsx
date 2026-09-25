import type { ReactNode } from 'react'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { useSessionStore } from '#/stores/session'

/** Renders its children only for a signed-in user who has finished first-run setup. */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status)
  const onboarded = useSessionStore((s) => Boolean(s.user?.onboardedAt))

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  if (!onboarded) return <RedirectTo to="/setup" />
  return <>{children}</>
}
