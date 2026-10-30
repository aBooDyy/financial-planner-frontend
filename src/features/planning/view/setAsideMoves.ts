/**
 * Which of one bill's or goal's set-asides were moved between its wallets, read back from the
 * rows a move leaves: the source is released and stamped with the transfer's id (or, with no
 * transfer behind it, an id of the move's own), and the new row — plus any remainder later split
 * off it — carries the same id from its creation. A row keeps that id when it is later paid,
 * freed or moved with no id, so a released row with no payment is either a move's source or an
 * arrival freed since; the wallets tell them apart. Pure.
 */
import type { LocalSetAside } from '#/db/types'

type Row = Pick<
  LocalSetAside,
  | 'id'
  | 'walletId'
  | 'amount'
  | 'currency'
  | 'date'
  | 'createdAt'
  | 'releasedAt'
  | 'releasedById'
  | 'movedByTransferId'
>

export type SetAsideMoves = {
  /** Rows a transfer carried off → the wallet the money went to. */
  movedTo: Map<string, string | null>
  /** Rows a transfer brought from another of these rows: not new money. */
  carried: Set<string>
  /** A source's id → the rows now holding its money. */
  arrivals: Map<string, string[]>
}

/** Released by no transaction: freed, closed, moved — never live, never paid. */
const releasedFree = (a: Row) =>
  a.releasedAt !== null && a.releasedById === null

const dayOf = (iso: string) => iso.slice(0, 10)

/**
 * The wallet a transfer's rows arrived in. A live or paid row can only be an arrival; failing
 * one, the rows created last are (a move's sources existed before it). None when every row sits
 * in one wallet — the move's other side is not among them.
 */
function arrivalWallet(group: ReadonlyArray<Row>): string | null | undefined {
  if (new Set(group.map((a) => a.walletId)).size < 2) return undefined
  const sure = group.find((a) => !releasedFree(a))
  if (sure) return sure.walletId
  const latest = group.reduce((x, y) =>
    y.createdAt.localeCompare(x.createdAt) > 0 ? y : x,
  )
  return latest.walletId
}

/**
 * A source whose arrival was moved on by another move (which re-stamped it): the row in another
 * wallet holding the same money, dated the day this one was released. Amounts only compare
 * within one currency.
 */
function onwardArrival(
  source: Row,
  rows: ReadonlyArray<Row>,
  taken: ReadonlySet<string>,
): Row | undefined {
  const day = dayOf(source.releasedAt as string)
  return rows.find(
    (a) =>
      !taken.has(a.id) &&
      releasedFree(a) &&
      a.movedByTransferId !== null &&
      a.movedByTransferId !== source.movedByTransferId &&
      a.walletId !== source.walletId &&
      a.date === day &&
      (a.amount === source.amount || a.currency !== source.currency),
  )
}

/**
 * Parts of an arrival later moved on (re-stamped, so no longer in the group): the rows in its
 * wallet dated the move's day that make up what the group's own rows fall short of. Only within
 * one currency, where the shortfall can be told.
 */
function arrivalPartsMovedOn(
  group: ReadonlyArray<Row>,
  sources: ReadonlyArray<Row>,
  to: string | null,
  rows: ReadonlyArray<Row>,
): Row[] {
  if (sources.length === 0) return []
  const first = sources[0]
  const held = group.filter((a) => a.walletId === to)
  if ([...sources, ...held].some((a) => a.currency !== first.currency))
    return []
  const sum = (list: ReadonlyArray<Row>) =>
    list.reduce((total, a) => total + a.amount, 0)
  const day = dayOf(first.releasedAt as string)
  const parts: Row[] = []
  let short = sum(sources) - sum(held)
  for (const a of rows) {
    if (
      short > 0 &&
      a.amount <= short &&
      a.walletId === to &&
      a.currency === first.currency &&
      a.date === day &&
      releasedFree(a) &&
      a.movedByTransferId !== null &&
      a.movedByTransferId !== first.movedByTransferId
    ) {
      parts.push(a)
      short -= a.amount
    }
  }
  return parts
}

export function setAsideMoves(rows: ReadonlyArray<Row>): SetAsideMoves {
  const movedTo = new Map<string, string | null>()
  const carried = new Set<string>()
  const arrivals = new Map<string, string[]>()
  const byTransfer = new Map<string, Row[]>()
  for (const a of rows) {
    if (!a.movedByTransferId) continue
    const group = byTransfer.get(a.movedByTransferId) ?? []
    group.push(a)
    byTransfer.set(a.movedByTransferId, group)
  }

  const unpaired: Row[] = []
  for (const group of byTransfer.values()) {
    const to = arrivalWallet(group)
    if (to === undefined) {
      unpaired.push(...group.filter(releasedFree))
      continue
    }
    const sources = group.filter((a) => a.walletId !== to && releasedFree(a))
    const landed =
      sources.length > 0
        ? [
            ...group.filter((a) => a.walletId === to),
            ...arrivalPartsMovedOn(group, sources, to, rows),
          ]
        : []
    for (const a of landed) carried.add(a.id)
    for (const a of sources) {
      movedTo.set(a.id, to)
      arrivals.set(
        a.id,
        landed.map((l) => l.id),
      )
    }
  }
  for (const source of unpaired) {
    const arrival = onwardArrival(source, rows, carried)
    if (!arrival) continue
    movedTo.set(source.id, arrival.walletId)
    carried.add(arrival.id)
    arrivals.set(source.id, [arrival.id])
  }
  return { movedTo, carried, arrivals }
}

type OwnedRow = Row & Pick<LocalSetAside, 'goalId' | 'billId' | 'deleted'>

/**
 * Every owner's `carried` rows. Takes the whole table: a move's two sides are dated differently,
 * so rows cut to a date window can't be paired.
 */
export function carriedSetAsides(rows: ReadonlyArray<OwnedRow>): Set<string> {
  const byOwner = new Map<string, OwnedRow[]>()
  for (const a of rows) {
    const owner = a.goalId ?? a.billId
    if (a.deleted !== 0 || owner === null) continue
    const owned = byOwner.get(owner)
    if (owned) owned.push(a)
    else byOwner.set(owner, [a])
  }
  const carried = new Set<string>()
  for (const owned of byOwner.values())
    for (const id of setAsideMoves(owned).carried) carried.add(id)
  return carried
}
