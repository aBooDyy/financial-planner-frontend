import { createFileRoute } from '@tanstack/react-router'
import { ImportSection } from '#/features/import/components/ImportSection'

export const Route = createFileRoute('/settings/import')({
  component: ImportSection,
})
