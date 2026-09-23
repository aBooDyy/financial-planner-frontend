import { createFileRoute } from '@tanstack/react-router'
import { PreferencesSection } from '#/features/settings/components/PreferencesSection'

export const Route = createFileRoute('/settings/preferences')({
  component: PreferencesSection,
})
