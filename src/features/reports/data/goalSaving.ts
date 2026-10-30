import type { LocalSetAside } from '#/db/types'
import { setAsideMoves } from '#/features/planning/view/setAsideMoves'
import type { SetAsideMoves } from '#/features/planning/view/setAsideMoves'

/** How much of a row's money ended up still held or used by a payment, from 0 to 1. */
function shareKept(
  row: LocalSetAside,
  byId: ReadonlyMap<string, LocalSetAside>,
  moves: SetAsideMoves,
  seen: ReadonlySet<string> = new Set(),
): number {
  if (row.releasedAt === null || row.releasedById !== null) return 1
  if (seen.has(row.id)) return 0
  const arrivals = (moves.arrivals.get(row.id) ?? [])
    .map((id) => byId.get(id))
    .filter((a) => a !== undefined)
  const total = arrivals.reduce((sum, a) => sum + a.amount, 0)
  if (total <= 0) return 0
  const next = new Set(seen).add(row.id)
  return arrivals.reduce(
    (sum, a) => sum + (a.amount / total) * shareKept(a, byId, moves, next),
    0,
  )
}

/**
 * The money **set aside for goals**, each row on the day it was first set aside: what is still
 * held, or was used by a payment. Money freed is not saving, even after being moved first. A move
 * adds nothing, so a moved row counts through the row it came from, cut to the share still kept.
 * Takes the whole table: a move's two sides are dated differently.
 */
export function goalSavingRows(
  setAsides: ReadonlyArray<LocalSetAside>,
): LocalSetAside[] {
  const byGoal = new Map<string, LocalSetAside[]>()
  for (const a of setAsides) {
    if (a.goalId === null || a.deleted !== 0) continue
    const rows = byGoal.get(a.goalId)
    if (rows) rows.push(a)
    else byGoal.set(a.goalId, [a])
  }
  const out: LocalSetAside[] = []
  for (const rows of byGoal.values()) {
    const moves = setAsideMoves(rows)
    const byId = new Map(rows.map((a) => [a.id, a]))
    for (const row of rows) {
      if (moves.carried.has(row.id)) continue
      const amount = Math.round(row.amount * shareKept(row, byId, moves))
      if (amount > 0) out.push({ ...row, amount })
    }
  }
  return out
}
