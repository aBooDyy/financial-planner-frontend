import { createFileRoute } from '@tanstack/react-router'
import { ArchivedSection } from '#/features/settings/components/ArchivedSection'

export const Route = createFileRoute('/settings/archived')({
  component: ArchivedSection,
})
