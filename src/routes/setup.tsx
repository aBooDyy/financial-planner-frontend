import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import type { User } from '#/features/auth/api/types'
import { OnboardingPage } from '#/features/onboarding/components/OnboardingPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/setup')({ component: SetupRoute })

/** First-run setup. Signed-in users who haven't finished it are sent here by `SessionGate`. */
function SetupRoute() {
  const status = useSessionStore((s) => s.status)
  const user = useSessionStore((s) => s.user)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous' || !user) return <RedirectTo to="/auth/login" />
  return <SetupEntry user={user} />
}

/**
 * Whether setup was already done is decided once, on arrival: finishing it mid-visit marks
 * the user onboarded, and the welcome step must still render after that.
 */
function SetupEntry({ user }: { user: User }) {
  const [alreadyDone] = useState(() => user.onboardedAt !== null)
  if (alreadyDone) return <RedirectTo to="/" />
  return <OnboardingPage user={user} />
}
