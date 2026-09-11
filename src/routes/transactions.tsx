import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { TransactionsPage } from '#/features/transactions/components/TransactionsPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/transactions')({
  component: TransactionsRoute,
})

function TransactionsRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <TransactionsPage />
}
