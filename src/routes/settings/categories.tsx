import { createFileRoute } from '@tanstack/react-router'
import { CategoriesSection } from '#/features/settings/components/CategoriesSection'

export const Route = createFileRoute('/settings/categories')({
  component: CategoriesSection,
})
