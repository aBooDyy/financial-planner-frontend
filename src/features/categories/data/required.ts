/** The roots every account keeps: the savings category and the per-type fallbacks. */
export const REQUIRED_ROOT_SLUGS: ReadonlySet<string> = new Set([
  'savings',
  'other',
  'other_income',
])

/** Whether the server refuses to delete this category (`settings.category.required`). */
export const isRequiredCategory = (category: {
  parentId: string | null
  slug: string
}): boolean =>
  category.parentId === null && REQUIRED_ROOT_SLUGS.has(category.slug)
