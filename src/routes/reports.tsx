import { createFileRoute } from '@tanstack/react-router'
import { SessionGate } from '#/components/SessionGate'
import { ReportsPage } from '#/features/reports/components/ReportsPage'
import { parseReportsSearch } from '#/features/reports/data/search'

export const Route = createFileRoute('/reports')({
  component: ReportsRoute,
  validateSearch: parseReportsSearch,
})

function ReportsRoute() {
  return (
    <SessionGate>
      <ReportsPage />
    </SessionGate>
  )
}
