import { createFileRoute } from '@tanstack/react-router'
import { MerchantsSection } from '#/features/settings/components/MerchantsSection'

export const Route = createFileRoute('/settings/merchants')({
  component: MerchantsSection,
})
