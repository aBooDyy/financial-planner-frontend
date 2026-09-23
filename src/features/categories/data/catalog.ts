import type { LocalCategory } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { IconId } from '#/lib/icons/catalog.gen'
import { CATEGORIES, defaultCategory, defaultSubcategory } from './defaults'
import type { DefaultCategory } from './defaults'
import { CATEGORY_ICON_FALLBACK, iconIdOr } from '#/lib/icons/fallbacks'

export type ResolvedSub = {
  /** The local row's id, absent when the sub comes from the built-in defaults. */
  id: string
  slug: string
  name: string
  color: string
  icon: IconId
  position: number
}

export type ResolvedCategory = {
  id: string
  slug: string
  name: string
  type: TxType
  color: string
  icon: IconId
  position: number
  subs: ResolvedSub[]
}

export type CategoryCatalog = {
  all: ResolvedCategory[]
  byType: (type: TxType) => ResolvedCategory[]
  get: (slug: string) => ResolvedCategory
  subsOf: (slug: string) => ResolvedSub[]
  sub: (slug: string, subSlug: string | null) => ResolvedSub | null
  /** The slug pair a row carries, rendered for display. */
  labelOf: (slug: string, subSlug: string | null) => string
}

const GENERIC_COLOR = '#64748B'

const byPosition = (a: LocalCategory, b: LocalCategory): number =>
  a.position - b.position || a.createdAt.localeCompare(b.createdAt)

const resolveSub = (
  row: LocalCategory,
  parent: LocalCategory,
  parentIcon: IconId,
): ResolvedSub => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  color: row.color.trim() || parent.color,
  icon: iconIdOr(
    row.icon,
    defaultSubcategory(parent.slug, row.slug)?.icon ?? parentIcon,
  ),
  position: row.position,
})

const fromDefault = (d: DefaultCategory): ResolvedCategory => ({
  id: d.id,
  slug: d.id,
  name: d.name,
  type: d.type,
  color: d.color,
  icon: d.icon,
  position: CATEGORIES.indexOf(d),
  subs: d.subs.map((s, i) => ({
    id: s.id,
    slug: s.id,
    name: s.name,
    color: d.color,
    icon: s.icon,
    position: i,
  })),
})

const BUILT_INS: ResolvedCategory[] = CATEGORIES.map(fromDefault)

/**
 * Nest the local category rows into the two-level catalog every screen reads names, colours,
 * icons and child lists from. Pure: no React, no IO — the selectors take the result as a
 * parameter so they stay pure too.
 */
export function buildCatalog(rows: LocalCategory[]): CategoryCatalog {
  const live = rows.filter((r) => r.deleted === 0)
  const roots = live.filter((r) => r.parentId === null).sort(byPosition)
  const rootsById = new Map(roots.map((r) => [r.id, r]))

  const childrenOf = new Map<string, LocalCategory[]>()
  for (const row of live) {
    // A child of a child would be a third level the ledger cannot represent, and a child of
    // a missing parent has nowhere to render — both are dropped rather than promoted.
    if (row.parentId === null || !rootsById.has(row.parentId)) continue
    const siblings = childrenOf.get(row.parentId)
    if (siblings) siblings.push(row)
    else childrenOf.set(row.parentId, [row])
  }

  const all: ResolvedCategory[] =
    roots.length === 0
      ? BUILT_INS
      : roots.map((row) => {
          const icon = iconIdOr(
            row.icon,
            defaultCategory(row.slug)?.icon ?? CATEGORY_ICON_FALLBACK[row.type],
          )
          return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            type: row.type,
            color: row.color.trim() || GENERIC_COLOR,
            icon,
            position: row.position,
            subs: (childrenOf.get(row.id) ?? [])
              .sort(byPosition)
              .map((child) => resolveSub(child, row, icon)),
          }
        })

  const bySlug = new Map(all.map((c) => [c.slug, c]))

  const unknown = (slug: string): ResolvedCategory => {
    const built = defaultCategory(slug)
    if (built) return fromDefault(built)
    return (
      bySlug.get('other') ?? {
        id: slug,
        slug,
        name: 'Other',
        type: 'spend',
        color: GENERIC_COLOR,
        icon: CATEGORY_ICON_FALLBACK.spend,
        position: all.length,
        subs: [],
      }
    )
  }

  const get = (slug: string): ResolvedCategory =>
    bySlug.get(slug) ?? unknown(slug)

  const sub = (slug: string, subSlug: string | null): ResolvedSub | null => {
    if (!subSlug) return null
    const found = get(slug).subs.find((s) => s.slug === subSlug)
    if (found) return found
    // A deleted or never-seeded built-in child still labels the transactions that name it.
    const built = defaultSubcategory(slug, subSlug)
    if (!built) return null
    const parent = get(slug)
    return {
      id: '',
      slug: built.id,
      name: built.name,
      color: parent.color,
      icon: built.icon,
      position: 0,
    }
  }

  return {
    all,
    byType: (type) => all.filter((c) => c.type === type),
    get,
    subsOf: (slug) => get(slug).subs,
    sub,
    labelOf: (slug, subSlug) => {
      const parent = get(slug)
      const child = sub(slug, subSlug)
      return child ? `${parent.name} · ${child.name}` : parent.name
    },
  }
}
