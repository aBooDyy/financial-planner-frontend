import { useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { moveInTiers, stepTarget } from '#/features/planning/view/reorder'
import type {
  RankChange,
  Ranked,
  TierKey,
} from '#/features/planning/view/reorder'

type Tiers = Readonly<Record<TierKey, ReadonlyArray<Ranked>>>

/**
 * Drag and drop across the two tiers (and ↑ / ↓ on a row's grip): works out the new positions
 * and hands them to `apply`. Returns the props each row spreads.
 */
export function useTierDrag(
  tiers: Tiers,
  apply: (changes: RankChange[]) => Promise<void>,
) {
  const [dragging, setDragging] = useState<string | null>(null)

  const drop = (toTier: TierKey, beforeId: string | null) => {
    if (!dragging) return
    const changes = moveInTiers(tiers, dragging, toTier, beforeId)
    setDragging(null)
    if (changes.length > 0) void apply(changes)
  }

  const rowProps = (id: string, tier: TierKey) => ({
    draggable: true,
    'data-dragging': dragging === id || undefined,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      setDragging(id)
    },
    onDragEnd: () => setDragging(null),
    onDragOver: (e: DragEvent) => {
      if (dragging) e.preventDefault()
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      drop(tier, id)
    },
  })

  const gripKeys = (id: string, tier: TierKey) => (e: KeyboardEvent) => {
    const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (step === 0) return
    e.preventDefault()
    const target = stepTarget(tiers[tier], id, step)
    if (!target) return
    void apply(moveInTiers(tiers, id, tier, target.beforeId))
  }

  return { dragging, rowProps, gripKeys }
}
