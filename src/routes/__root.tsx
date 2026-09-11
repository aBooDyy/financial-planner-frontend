import { useEffect } from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useSessionBootstrap } from '#/features/auth/hooks/useSessionBootstrap'
import { useEmailSyncBootstrap } from '#/features/email-sync/hooks/useEmailSyncBootstrap'
import { applyStoredDirection } from '#/stores/direction'
import { applyStoredTheme } from '#/stores/theme'
import { TooltipProvider } from '#/components/ui/tooltip'

export const Route = createRootRoute({ component: RootLayout })

function RootLayout() {
  useSessionBootstrap()
  useEmailSyncBootstrap()

  useEffect(() => {
    applyStoredTheme()
    applyStoredDirection()
  }, [])

  return (
    <TooltipProvider>
      <Outlet />
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
        ]}
      />
    </TooltipProvider>
  )
}
