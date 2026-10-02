import { useEffect } from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Direction } from 'radix-ui'
import { useSync } from '#/db/useSync'
import { useSessionBootstrap } from '#/features/auth/hooks/useSessionBootstrap'
import { useEmailSyncBootstrap } from '#/features/email-sync/hooks/useEmailSyncBootstrap'
import { PayloadViewContext } from '#/features/inbound-imports/components/payloadView'
import { usePlannedRunner } from '#/features/planned'
import { AppToastHost } from '#/features/planning/components/shell/AppToastHost'
import { LeftoverPromptHost } from '#/features/transactions/components/LeftoverPromptHost'
import { UpdatePrompt, usePersistentStorage } from '#/features/pwa'
import { ReviewPayloadTree } from '#/features/integrations/components/ReviewPayloadTree'
import { useAppConfig } from '#/lib/config/useAppConfig'
import { loadIconPaths } from '#/lib/icons/paths'
import { useCustomCurrencies } from '#/lib/config/useCustomCurrencies'
import { applyStoredDirection, useDirectionStore } from '#/stores/direction'
import { applyStoredTheme, followSystemTheme } from '#/stores/theme'
import { TooltipProvider } from '#/components/ui/tooltip'
import { Devtools } from '#/components/dev/Devtools'

export const Route = createRootRoute({ component: RootLayout })

function RootLayout() {
  useSessionBootstrap()
  useAppConfig()
  useCustomCurrencies()
  useSync()
  usePlannedRunner()
  useEmailSyncBootstrap()
  usePersistentStorage()

  // Radix portals its menus outside the app subtree and falls back to `ltr` unless a
  // DirectionProvider supplies the direction, so logical utilities inside them need this.
  const direction = useDirectionStore((s) => s.direction)

  useEffect(() => {
    applyStoredTheme()
    applyStoredDirection()
    // Started here so the icon chunk flies alongside the first local-DB reads.
    void loadIconPaths()
    return followSystemTheme()
  }, [])

  return (
    <Direction.Provider dir={direction}>
      <TooltipProvider>
        <PayloadViewContext.Provider value={ReviewPayloadTree}>
          <Outlet />
        </PayloadViewContext.Provider>
        <LeftoverPromptHost />
        <AppToastHost />
        <UpdatePrompt />
        <Devtools />
      </TooltipProvider>
    </Direction.Provider>
  )
}
