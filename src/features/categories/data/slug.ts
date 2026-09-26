/** Turn a category name into a stable, URL-safe slug. Deterministic, so callers dedupe it
 *  against the sibling slugs already taken (`uniqueSlug`). */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'category'

/**
 * The name's slug, suffixed `_2`, `_3`… until it clashes with none of `taken`. Slugs are unique
 * among siblings only, so `taken` is the slugs of the new category's siblings.
 */
export const uniqueSlug = (name: string, taken: Iterable<string>): string => {
  const used = new Set(taken)
  const base = slugify(name)
  if (!used.has(base)) return base
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}_${suffix}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}_${crypto.randomUUID().slice(0, 6)}`
}
