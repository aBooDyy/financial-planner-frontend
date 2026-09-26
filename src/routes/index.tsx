import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { SessionGate } from '#/components/SessionGate'

export const Route = createFileRoute('/')({ component: Index })

function Index() {
  return (
    <SessionGate>
      <RedirectTo to="/wallets" />
    </SessionGate>
  )
}
