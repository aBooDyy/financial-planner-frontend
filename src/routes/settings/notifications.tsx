import { createFileRoute } from '@tanstack/react-router'
import { NotificationsSection } from '#/features/settings/components/NotificationsSection'

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsSection,
})
