import { Hammer } from 'lucide-react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { useSessionStore } from '#/stores/session'

/** Stands in for the Goals page while Planning (bills, goals, income) is rebuilt. */
export function GoalsPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  if (!user) return null

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav user={user} active="goals" onSignOut={() => void logout()} />
      <main className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <Hammer aria-hidden className="size-8 text-fp-text-3" />
          <h1 className="text-lg font-semibold">Planning is being rebuilt</h1>
          <p className="text-sm text-fp-text-2">
            Bills, goals and income are moving to a new Planning page. Your
            wallets and spending are unaffected.
          </p>
        </div>
      </main>
      <MobileTabBar active="goals" />
    </div>
  )
}
