import { createFileRoute } from '@tanstack/react-router'
import { RedirectTo } from '#/components/RedirectTo'
import { Splash } from '#/components/Splash'
import { ImportPage } from '#/features/import/components/ImportPage'
import { useSessionStore } from '#/stores/session'

export const Route = createFileRoute('/import')({ component: ImportRoute })

function ImportRoute() {
  const status = useSessionStore((s) => s.status)

  if (status === 'loading') return <Splash />
  if (status === 'anonymous') return <RedirectTo to="/auth/login" />
  return <ImportPage />
}
