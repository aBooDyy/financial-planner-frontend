import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { AuthScreen } from '#/features/auth/components/AuthScreen'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/auth/signup')({ component: SignupRoute })

function SignupRoute() {
  const status = useSessionStore((s) => s.status)
  if (status === 'authenticated') return <RedirectTo to="/" />
  return <AuthScreen mode="signup" />
}
