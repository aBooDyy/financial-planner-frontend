/** Turn a category name into a stable, URL-safe slug. Transactions reference this slug, so
 *  it must be deterministic and collision-resistant (callers dedupe against existing slugs). */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'category'
