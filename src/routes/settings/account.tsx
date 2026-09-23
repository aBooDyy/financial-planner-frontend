import { createFileRoute } from '@tanstack/react-router'
import { AccountSection } from '#/features/settings/components/AccountSection'

export const Route = createFileRoute('/settings/account')({
  component: AccountSection,
})
