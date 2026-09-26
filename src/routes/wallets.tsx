import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '#/features/wallets/components/WalletsPage'
import { SessionGate } from '#/components/SessionGate'

export const Route = createFileRoute('/wallets')({ component: WalletsRoute })

function WalletsRoute() {
  return (
    <SessionGate>
      <WalletsPage />
    </SessionGate>
  )
}
