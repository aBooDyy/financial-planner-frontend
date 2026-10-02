/**
 * Drag to reorder across the two priority tiers (D10: position breaks ties inside a tier).
 * Dropping on a row of the other tier moves the item into that tier. Pure.
 */

export type TierKey = 'must' | 'nice'

export type Ranked = { id: string; position: number }

export type RankChange = { id: string; position: number; tier: TierKey }

/**
 * The changes that put `dragId` before `beforeId` (or last) in `toTier`, numbering both tiers'
 * rows from 0 in their new order. Only rows whose position or tier moved are returned.
 */
export function moveInTiers(
  tiers: Readonly<Record<TierKey, ReadonlyArray<Ranked>>>,
  dragId: string,
  toTier: TierKey,
  beforeId: string | null,
): RankChange[] {
  const fromTier: TierKey | undefined = (['must', 'nice'] as const).find((t) =>
    tiers[t].some((r) => r.id === dragId),
  )
  if (!fromTier || dragId === beforeId) return []
  const lists: Record<TierKey, Ranked[]> = {
    must: tiers.must.filter((r) => r.id !== dragId),
    nice: tiers.nice.filter((r) => r.id !== dragId),
  }
  const dragged = tiers[fromTier].find((r) => r.id === dragId)
  if (!dragged) return []
  const target = lists[toTier]
  const at = beforeId ? target.findIndex((r) => r.id === beforeId) : -1
  target.splice(at < 0 ? target.length : at, 0, dragged)

  const changes: RankChange[] = []
  for (const tier of ['must', 'nice'] as const) {
    lists[tier].forEach((r, position) => {
      const movedTier = r.id === dragId && tier !== fromTier
      if (r.position !== position || movedTier)
        changes.push({ id: r.id, position, tier })
    })
  }
  return changes
}

/** Where a keyboard step (↑ / ↓ on a row's grip) drops a row: before which neighbour, or last. */
export function stepTarget(
  tier: ReadonlyArray<Ranked>,
  id: string,
  step: -1 | 1,
): { beforeId: string | null } | null {
  const at = tier.findIndex((r) => r.id === id)
  if (at < 0 || at + step < 0 || at + step >= tier.length) return null
  if (step === -1) return { beforeId: tier[at - 1].id }
  return { beforeId: (tier[at + 2] as Ranked | undefined)?.id ?? null }
}
