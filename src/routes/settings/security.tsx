import { createFileRoute } from '@tanstack/react-router'
import { SecuritySection } from '#/features/passkeys/components/SecuritySection'

export const Route = createFileRoute('/settings/security')({
  component: SecuritySection,
})
