import { commandFilter } from '#/components/ui/command'
import type { ResolvedCategory, ResolvedSub } from './catalog'

/** One parent and the children shown under it — the parent row is itself pickable. */
export type PickerSection = {
  parent: ResolvedCategory
  subs: ResolvedSub[]
}

/** cmdk's item value for a pick; unique across the whole list. */
export const pickerValue = (slug: string, subSlug: string | null): string =>
  subSlug ? `${slug}/${subSlug}` : slug

const scored = (
  parent: ResolvedCategory,
  search: string,
): { section: PickerSection; score: number } | null => {
  const parentScore = commandFilter(parent.name, search)
  // A parent that matches brings every child along: typing "Food" should list what's in it.
  if (parentScore > 0)
    return { section: { parent, subs: parent.subs }, score: parentScore }

  const hits = parent.subs
    .map((sub) => ({
      sub,
      score: commandFilter(`${sub.name} ${parent.name}`, search),
    }))
    .filter((hit) => hit.score > 0)
  if (hits.length === 0) return null
  return {
    section: { parent, subs: hits.map((hit) => hit.sub) },
    score: Math.max(...hits.map((hit) => hit.score)),
  }
}

/**
 * The picker's list for a query: every parent with its children when empty; otherwise the
 * parents that match (with all their children) and the parents of children that match (with
 * just those children), best match first.
 */
export function pickerSections(
  categories: ReadonlyArray<ResolvedCategory>,
  query: string,
): PickerSection[] {
  const search = query.trim()
  if (search === '')
    return categories.map((parent) => ({ parent, subs: parent.subs }))
  return categories
    .map((parent) => scored(parent, search))
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.section)
}
