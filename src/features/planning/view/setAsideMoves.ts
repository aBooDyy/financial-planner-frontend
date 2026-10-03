/**
 * Which of one bill's or goal's set-asides a transfer moved between its wallets, read back from
 * the rows a move leaves: the source is released and stamped with the transfer's id, and the new
 * row — plus any remainder later split off it — carries the same id from its creation. A row
 * keeps that id when it is later paid, freed or moved without a transfer, so a released row with
 * no payment is either a move's source or an arrival freed since; the wallets tell them apart.
 * Pure.
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
 * A source whose arrival was moved on by another transfer (which re-stamped it): the row in
 * another wallet holding the same money, dated the day this one was released.
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
      a.amount === source.amount &&
      a.currency === source.currency,
  )
}

export function setAsideMoves(rows: ReadonlyArray<Row>): SetAsideMoves {
  const movedTo = new Map<string, string | null>()
  const carried = new Set<string>()
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
    for (const a of sources) movedTo.set(a.id, to)
    if (sources.length > 0)
      for (const a of group) if (a.walletId === to) carried.add(a.id)
  }
  for (const source of unpaired) {
    const arrival = onwardArrival(source, rows, carried)
    if (!arrival) continue
    movedTo.set(source.id, arrival.walletId)
    carried.add(arrival.id)
  }
  return { movedTo, carried }
}
