import { createFileRoute, redirect } from '@tanstack/react-router'
import { TransactionsPage } from '#/features/transactions/components/TransactionsPage'
import { isSpendingView } from '#/features/transactions/constants'

export const Route = createFileRoute('/transactions/$view')({
  component: TransactionsPage,
  beforeLoad: ({ params, search }) => {
    if (!isSpendingView(params.view))
      throw redirect({
        to: '/transactions/$view',
        params: { view: 'activity' },
        search,
        replace: true,
      })
  },
})
