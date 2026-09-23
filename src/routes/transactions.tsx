import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { TransactionsPage } from '#/features/transactions/components/TransactionsPage'
import { useSessionStore } from '#/stores/session'

export type TransactionsSearch = {
  /** `?review=1` — land straight in the pending-import review modal. */
  review?: boolean
}

export const Route = createFileRoute('/transactions')({
  component: TransactionsRoute,
  validateSearch: (search: Record<string, unknown>): TransactionsSearch => {
    const review = search.review
    return review === true || review === 1 || review === '1'
      ? { review: true }
      : {}
  },
})

function TransactionsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <TransactionsPage />
}
