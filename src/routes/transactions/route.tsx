import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SessionGate } from '#/components/SessionGate'
import {
  encodeOpenParam,
  parseOpenParam,
} from '#/features/transactions/data/openParam'

export type TransactionsSearch = {
  /** `?review=1` — land straight in the pending-import review modal. */
  review?: boolean
  /** `?open=<kind>:<id>` — open that item's editor once the page has its data. */
  open?: string
}

export const Route = createFileRoute('/transactions')({
  component: TransactionsRoute,
  validateSearch: (search: Record<string, unknown>): TransactionsSearch => {
    const review = search.review
    const result: TransactionsSearch = {}
    if (review === true || review === 1 || review === '1') result.review = true
    const open = parseOpenParam(search.open)
    if (open) result.open = encodeOpenParam(open)
    return result
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
