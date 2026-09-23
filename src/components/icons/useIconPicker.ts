import { useEffect, useMemo, useState } from 'react'
import { ICON_GROUPS, ICON_IDS, isIconId } from '#/lib/icons/catalog.gen'
import { loadIconPaths } from '#/lib/icons/paths'
import { usePreferencesStore } from '#/stores/preferences'
import type { IconId } from '#/lib/icons/catalog.gen'
import type { IconSearchEntry } from '#/lib/icons/search.gen'

export type IconSearchIndex = Record<IconId, IconSearchEntry>

export type IconPickerGroup = {
  key: string
  label: string
  ids: Array<IconId>
}

let pending: Promise<IconSearchIndex> | null = null

/** The search index is only ever needed by an open picker, so it loads on first open. */
export const loadIconSearch = (): Promise<IconSearchIndex> =>
  (pending ??= import('../../lib/icons/search.gen').then((m) => m.SEARCH))

const WHOLE_FIELD = 100
const WORD_START = 70
const ANYWHERE = 40
/** Which field matched, as a tie-break: an exact keyword still beats a label prefix. */
const FIELD_BONUS = { label: 3, keyword: 2, id: 1 }

const words = (value: string) => value.toLowerCase().replace(/[-_]+/g, ' ')

const scoreField = (field: string, term: string): number => {
  if (field === term) return WHOLE_FIELD
  if (field.startsWith(term) || field.includes(` ${term}`)) return WORD_START
  return field.includes(term) ? ANYWHERE : 0
}

const withBonus = (score: number, bonus: number) =>
  score === 0 ? 0 : score + bonus

const scoreTerm = (id: IconId, entry: IconSearchEntry, term: string): number =>
  Math.max(
    withBonus(scoreField(words(entry.label), term), FIELD_BONUS.label),
    withBonus(scoreField(words(id), term), FIELD_BONUS.id),
    ...entry.keywords.map((kw) =>
      withBonus(scoreField(words(kw), term), FIELD_BONUS.keyword),
    ),
  )

/**
 * Every term of the query has to land somewhere on the icon, and the strongest kind of hit
 * wins: an exact keyword ("save" on `piggy-bank`) outranks a label that merely starts with
 * it ("Saved"), which in turn outranks a substring buried mid-word.
 */
const scoreIcon = (
  id: IconId,
  entry: IconSearchEntry,
  terms: Array<string>,
): number => {
  let total = 0
  for (const term of terms) {
    const score = scoreTerm(id, entry, term)
    if (score === 0) return 0
    total += score
  }
  return total
}

/** Ranked ids for a query; ties keep the manifest's order. */
export const matchIconIds = (
  index: IconSearchIndex,
  query: string,
): Array<IconId> => {
  const terms = words(query).split(' ').filter(Boolean)
  if (terms.length === 0) return [...ICON_IDS]
  return ICON_IDS.map((id) => ({ id, score: scoreIcon(id, index[id], terms) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.id)
}

const browseGroups = (recent: Array<IconId>): Array<IconPickerGroup> => {
  const groups = ICON_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    ids: [...g.ids],
  }))
  return recent.length === 0
    ? groups
    : [{ key: 'recent', label: 'Recent', ids: recent }, ...groups]
}

export type IconPickerModel = {
  query: string
  setQuery: (value: string) => void
  /** False until both lazy chunks are in; the picker shows its skeleton grid meanwhile. */
  ready: boolean
  searching: boolean
  groups: Array<IconPickerGroup>
  labelOf: (id: IconId) => string
}

/**
 * Owns the picker's two lazy chunks, its query, and the grouping and ranking of the pack.
 * Browsing shows Recent then the manifest's groups; searching collapses to one ranked list.
 */
export function useIconPicker(): IconPickerModel {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<IconSearchIndex | null>(null)
  const recentIds = usePreferencesStore((s) => s.recentIcons)

  useEffect(() => {
    let alive = true
    void Promise.all([loadIconSearch(), loadIconPaths()]).then(([search]) => {
      if (alive) setIndex(search)
    })
    return () => {
      alive = false
    }
  }, [])

  const recent = useMemo(() => recentIds.filter(isIconId), [recentIds])
  const searching = query.trim() !== ''

  const groups = useMemo(() => {
    if (index === null) return []
    if (!searching) return browseGroups(recent)
    return [
      { key: 'results', label: 'Results', ids: matchIconIds(index, query) },
    ]
  }, [index, searching, query, recent])

  return {
    query,
    setQuery,
    ready: index !== null,
    searching,
    groups,
    labelOf: (id) => index?.[id].label ?? id,
  }
}
