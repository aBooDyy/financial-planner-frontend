/**
 * Where one set-aside stands, and so what can still be done to it: a live one can be changed, one
 * freed can be set aside again, and one a payment used or a move carried off is history. Pure.
 */
import type { LocalSetAside } from '#/db/types'
import { setAsideMoves } from './setAsideMoves'

export type SetAsideState =
  | { kind: 'live' }
  | { kind: 'used'; byId: string }
  | { kind: 'moved' }
  | { kind: 'freed'; on: string }

const dayOf = (iso: string) => iso.slice(0, 10)

/** A move with no transfer leaves no id: only the row written that day for the same money. */
const carriedOffTo = (
  row: LocalSetAside,
  rows: ReadonlyArray<LocalSetAside>,
): boolean => {
  const day = dayOf(row.releasedAt ?? '')
  return rows.some(
    (o) =>
      o.id !== row.id &&
      o.deleted === 0 &&
      o.date === day &&
      dayOf(o.createdAt) === day &&
      o.amount === row.amount &&
      o.currency === row.currency,
  )
}

/** `rows` are the set-asides of the same bill or goal. */
export function setAsideStateOf(
  row: LocalSetAside,
  rows: ReadonlyArray<LocalSetAside>,
): SetAsideState {
  if (row.releasedAt === null) return { kind: 'live' }
  if (row.releasedById) return { kind: 'used', byId: row.releasedById }
  const moved =
    setAsideMoves(rows).movedTo.has(row.id) || carriedOffTo(row, rows)
  return moved
    ? { kind: 'moved' }
    : { kind: 'freed', on: dayOf(row.releasedAt) }
}
