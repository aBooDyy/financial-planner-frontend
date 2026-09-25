import { createFileRoute } from '@tanstack/react-router'
import { ImportPage } from '#/features/import/components/ImportPage'
import { SessionGate } from '#/components/SessionGate'

export const Route = createFileRoute('/import')({ component: ImportRoute })

function ImportRoute() {
  return (
    <SessionGate>
      <ImportPage />
    </SessionGate>
  )
}
