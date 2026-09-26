import type { ReactNode } from 'react'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { QuickAddFab } from '#/features/transactions/components/QuickAddFab'
import { QuickAddSheet } from '#/features/transactions/components/QuickAddSheet'
import { useSessionStore } from '#/stores/session'

/**
 * Renders its children only for a signed-in user who has finished first-run setup, along with
 * the "add transaction" entry point every signed-in page offers.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status)
  const onboarded = useSessionStore((s) => Boolean(s.user?.onboardedAt))

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  if (!onboarded) return <RedirectTo to="/setup" />
  return (
    <>
      {children}
      <QuickAddFab />
      <QuickAddSheet />
    </>
  )
}
