import { createFileRoute } from '@tanstack/react-router'
import { BalancesPage } from '#/features/balances/components/BalancesPage'
import { SessionGate } from '#/components/SessionGate'

export const Route = createFileRoute('/balances')({ component: BalancesRoute })

function BalancesRoute() {
  return (
    <SessionGate>
      <BalancesPage />
    </SessionGate>
  )
}
