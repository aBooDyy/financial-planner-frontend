import type { ReactNode } from 'react'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { useCategoryCatalogState } from '#/features/categories/hooks/useCategoryCatalog'
import { SearchSheet } from '#/features/search/components/SearchSheet'
import { QuickAddFab } from '#/features/transactions/components/QuickAddFab'
import { QuickAddSheet } from '#/features/transactions/components/QuickAddSheet'
import { useSessionStore } from '#/stores/session'

/**
 * Renders its children only for a signed-in user who has finished first-run setup and whose
 * categories are on this device, along with the "add transaction" entry point and the search
 * sheet every signed-in page offers. Rows name categories by id, so nothing below can render
 * them before the catalog arrives — on a new device, after setup, or after a local wipe.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status)
  const onboarded = useSessionStore((s) => Boolean(s.user?.onboardedAt))
  const catalogLoaded = useCategoryCatalogState().loaded

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  if (!onboarded) return <RedirectTo to="/setup" />
  if (!catalogLoaded) return <Splash />
  return (
    <>
      {children}
      <QuickAddFab />
      <QuickAddSheet />
      <SearchSheet />
    </>
  )
}
