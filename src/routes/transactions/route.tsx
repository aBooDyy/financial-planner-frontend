import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SessionGate } from '#/components/SessionGate'

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

/** The session guard every Spending view shares. Each view is a child route. */
function TransactionsRoute() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}
