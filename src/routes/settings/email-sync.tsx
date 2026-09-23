import { createFileRoute } from '@tanstack/react-router'
import { EmailSyncSection } from '#/features/email-sync/components/EmailSyncSection'

export const Route = createFileRoute('/settings/email-sync')({
  component: EmailSyncSection,
})
