import type { LocalSetAside } from '#/db/types'

type Row = Pick<
  LocalSetAside,
  'goalId' | 'deleted' | 'releasedAt' | 'releasedById' | 'movedByTransferId'
>

/**
 * Whether a set-aside counts as money **set aside for goals** on the day it is dated. Money
 * later spent from the goal still counts (it was saved, then used); money freed again does not;
 * a move's new row does not either — the money was already counted when it was first set
 * aside. A move with no transfer leaves no mark on either row, so its source reads as freed
 * and its new row as fresh: that money counts once, on the move's date.
 */
export function countsAsGoalSaving(a: Row): boolean {
  if (a.goalId === null || a.deleted !== 0) return false
  const releasedUnused = a.releasedAt !== null && a.releasedById === null
  const moved = a.movedByTransferId !== null
  const freed = releasedUnused && !moved
  const movedIn = moved && !releasedUnused
  return !freed && !movedIn
}
