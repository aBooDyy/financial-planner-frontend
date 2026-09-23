import { createFileRoute } from '@tanstack/react-router'
import { CurrenciesSection } from '#/features/settings/components/CurrenciesSection'

export const Route = createFileRoute('/settings/currencies')({
  component: CurrenciesSection,
})
