import { createFileRoute } from '@tanstack/react-router'
import { DataSection } from '#/features/settings/components/DataSection'

export const Route = createFileRoute('/settings/data')({
  component: DataSection,
})
