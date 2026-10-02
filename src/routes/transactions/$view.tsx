import { createFileRoute, redirect } from '@tanstack/react-router'
import { TransactionsPage } from '#/features/transactions/components/TransactionsPage'
import { isSpendingView } from '#/features/transactions/constants'

// The Planned and Recurring tabs moved to Planning.
const MOVED_TO_PLANNING = {
  planned: 'upcoming',
  recurring: 'bills',
} as const

export const Route = createFileRoute('/transactions/$view')({
  component: TransactionsPage,
  beforeLoad: ({ params, search }) => {
    if (params.view === 'planned' || params.view === 'recurring')
      throw redirect({
        to: '/planning/$section',
        params: { section: MOVED_TO_PLANNING[params.view] },
        replace: true,
      })
    if (!isSpendingView(params.view))
      throw redirect({
        to: '/transactions/$view',
        params: { view: 'activity' },
        search,
        replace: true,
      })
  },
})
