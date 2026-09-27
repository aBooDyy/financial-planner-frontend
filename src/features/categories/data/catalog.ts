import type { LocalCategory } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { IconId } from '#/lib/icons/catalog.gen'
import { defaultCategory, defaultSubcategory } from './defaults'
import { CATEGORY_ICON_FALLBACK, iconIdOr } from '#/lib/icons/fallbacks'

type Entry = {
  id: string
  slug: string
  name: string
  /** A child's is its parent's. */
  type: TxType
  color: string
  icon: IconId
  position: number
}

export type ResolvedSub = Entry & { parentId: string }

export type ResolvedCategory = Entry & { parentId: null; subs: ResolvedSub[] }

/** Anything a row can be filed under: a root or one of its children. */
export type CatalogEntry = ResolvedCategory | ResolvedSub

export type CategoryCatalog = {
  /** The roots, in display order. Empty means the categories have not been pulled yet. */
  all: ResolvedCategory[]
  byType: (type: TxType) => ResolvedCategory[]
  /** Whether the catalog holds `id` — a live root or child. */
  has: (id: string) => boolean
  /** Never throws: an id the catalog does not hold resolves to `DELETED_CATEGORY`. */
  get: (id: string) => CatalogEntry
  /** The root itself, or a child's parent. */
  rootOf: (id: string) => ResolvedCategory
  /** A child's parent; null for a root or an unknown id. */
  parentOf: (id: string) => ResolvedCategory | null
  subsOf: (rootId: string) => ResolvedSub[]
  /** ["Dining", "Cafés"] for a child, ["Dining"] for a root. */
  pathOf: (id: string) => string[]
  /** "Dining · Cafés" for a child, "Dining" for a root. */
  labelOf: (id: string) => string
  /** Lookup by slug — a root's alone, a child's under its parent's slug. */
  bySlug: (slug: string, parentSlug?: string) => CatalogEntry | null
  /**
   * Where a row of `type` goes when nothing chose a category: the required `other` /
   * `other_income` root, else the type's first root. Null only while nothing is loaded.
   */
  fallbackFor: (type: TxType) => ResolvedCategory | null
}

export const DELETED_CATEGORY_ID = 'deleted-category'

const GENERIC_COLOR = '#64748B'

/**
 * What an id resolves to when the catalog does not hold it. Rows reference categories by
 * foreign key, so this marks a transient state (a delete not yet pulled), never lost data.
 */
export const DELETED_CATEGORY: ResolvedCategory = {
  id: DELETED_CATEGORY_ID,
  parentId: null,
  slug: '',
  name: 'Deleted category',
  type: 'spend',
  color: GENERIC_COLOR,
  icon: CATEGORY_ICON_FALLBACK.spend,
  position: Number.MAX_SAFE_INTEGER,
  subs: [],
}

const FALLBACK_SLUG: Record<TxType, string> = {
  spend: 'other',
  income: 'other_income',
}

const byPosition = (a: LocalCategory, b: LocalCategory): number =>
  a.position - b.position || a.createdAt.localeCompare(b.createdAt)

const resolveRoot = (
  row: LocalCategory,
  children: LocalCategory[],
): ResolvedCategory => {
  const icon = iconIdOr(
    row.icon,
    defaultCategory(row.slug)?.icon ?? CATEGORY_ICON_FALLBACK[row.type],
  )
  const color = row.color.trim() || GENERIC_COLOR
  return {
    id: row.id,
    parentId: null,
    slug: row.slug,
    name: row.name,
    type: row.type,
    color,
    icon,
    position: row.position,
    subs: children.sort(byPosition).map((child) => ({
      id: child.id,
      parentId: row.id,
      slug: child.slug,
      name: child.name,
      type: row.type,
      color: child.color.trim() || color,
      icon: iconIdOr(
        child.icon,
        defaultSubcategory(row.slug, child.slug)?.icon ?? icon,
      ),
      position: child.position,
    })),
  }
}

const nest = (rows: LocalCategory[]): ResolvedCategory[] => {
  const live = rows.filter((r) => r.deleted === 0)
  const roots = live.filter((r) => r.parentId === null).sort(byPosition)
  const rootIds = new Set(roots.map((r) => r.id))

  const childrenOf = new Map<string, LocalCategory[]>()
  for (const row of live) {
    // A child of a child would be a third level, and a child of a missing parent has nowhere
    // to render — both are dropped rather than promoted.
    if (row.parentId === null || !rootIds.has(row.parentId)) continue
    const siblings = childrenOf.get(row.parentId)
    if (siblings) siblings.push(row)
    else childrenOf.set(row.parentId, [row])
  }

  return roots.map((row) => resolveRoot(row, childrenOf.get(row.id) ?? []))
}

/**
 * Nest the local category rows into the two-level catalog every screen reads names, colours,
 * icons and child lists from, keyed by id. Pure: no React, no IO — the selectors take the
 * result as a parameter so they stay pure too.
 */
export function buildCatalog(rows: LocalCategory[]): CategoryCatalog {
  const all = nest(rows)

  const byId = new Map<string, CatalogEntry>()
  const rootBySlug = new Map<string, ResolvedCategory>()
  for (const root of all) {
    byId.set(root.id, root)
    rootBySlug.set(root.slug, root)
    for (const sub of root.subs) byId.set(sub.id, sub)
  }

  const get = (id: string): CatalogEntry => byId.get(id) ?? DELETED_CATEGORY

  const parentOf = (id: string): ResolvedCategory | null => {
    const entry = byId.get(id)
    if (!entry?.parentId) return null
    return byId.get(entry.parentId) as ResolvedCategory
  }

  const pathOf = (id: string): string[] => {
    const parent = parentOf(id)
    const name = get(id).name
    return parent ? [parent.name, name] : [name]
  }

  const rootOf = (id: string): ResolvedCategory => {
    const entry = get(id)
    return entry.parentId === null ? entry : (parentOf(id) ?? DELETED_CATEGORY)
  }

  const byType = (type: TxType): ResolvedCategory[] =>
    all.filter((c) => c.type === type)

  return {
    all,
    byType,
    has: (id) => byId.has(id),
    get,
    rootOf,
    parentOf,
    subsOf: (rootId) => {
      const entry = byId.get(rootId)
      return entry?.parentId === null ? entry.subs : []
    },
    pathOf,
    labelOf: (id) => pathOf(id).join(' · '),
    bySlug: (slug, parentSlug) => {
      if (parentSlug === undefined) return rootBySlug.get(slug) ?? null
      const parent = rootBySlug.get(parentSlug)
      return parent?.subs.find((s) => s.slug === slug) ?? null
    },
    fallbackFor: (type) => {
      const required = rootBySlug.get(FALLBACK_SLUG[type])
      if (required?.type === type) return required
      return byType(type)[0] ?? null
    },
  }
}
