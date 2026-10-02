import type { LocalSetAside } from '#/db/types'

type Row = Pick<
  LocalSetAside,
  'goalId' | 'deleted' | 'releasedAt' | 'releasedById'
>

/**
 * Whether a set-aside counts as money **set aside for goals** on the day it is dated: one still
 * held, or one a payment used (it was saved, then spent). One released without a payment does
 * not — freed, closed, or the source of a move, whose money counts through the row the move
 * wrote instead. So moved money counts once, dated the move.
 */
export function countsAsGoalSaving(a: Row): boolean {
  if (a.goalId === null || a.deleted !== 0) return false
  return a.releasedAt === null || a.releasedById !== null
}
