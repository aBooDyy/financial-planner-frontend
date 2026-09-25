import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '#/features/settings/components/SettingsLayout'
import { SessionGate } from '#/components/SessionGate'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

/** The chrome every Settings pane shares. Each pane is a child route rendered in its Outlet. */
function SettingsRoute() {
  return (
    <SessionGate>
      <SettingsLayout />
    </SessionGate>
  )
}
