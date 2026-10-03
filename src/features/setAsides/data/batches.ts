/**
 * Releasing and moving set-asides — "Free it up", a payment releasing what it used, "move them
 * with the transfer", "Move to…" another bill or goal. Each is applied here at once and queued
 * as **one** batch entry the server applies all-or-nothing (`/set-asides/release`, `/move`).
 *
 * Every row stays wholly live or wholly released: a part smaller than a row releases the row
 * with its amount cut to the part and writes the rest as a new live row (the remainder). Ids of
 * remainders and moved rows are minted here and sent with the batch, so they exist offline and
 * the server's rows are these rows. The touched rows are marked dirty; the batch carries them.
 * More parts than the server takes in one batch (`limits.setAsideBatchMax`) are queued as
 * several batches, each all-or-nothing on its own.
 */
import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalSetAside, OutboxOp } from '#/db/types'
import type {
  MoveItemWire,
  MoveTargetWire,
  MoveWire,
  ReleaseItemWire,
  ReleaseWire,
} from '#/features/setAsides/api/types'
import { isoOf } from '#/features/planned/data/dates'
import { configLimits } from '#/lib/config/appConfig'
import { newId } from '#/lib/uuid'
import type { SetAsideOwner } from './mutations'
import { isLiveSetAside } from './totals'

/** One row to act on, whole or — with a smaller `amount`, in the row's currency — in part. */
export type SetAsidePart = { id: string; amount?: number }

export type MoveTarget = {
  /** Into another wallet (it becomes a wallet set-aside). */
  walletId?: string
  /** For another bill or goal (the planned link is dropped); its own keeps the link. */
  owner?: SetAsideOwner
}

export type MovePart = SetAsidePart & { to: MoveTarget }

/** A batch referred to a row that is not live here (gone, or already released). */
export class SetAsideBatchError extends Error {
  readonly id: string
  constructor(id: string) {
    super(`set-aside ${id} is not live`)
    this.id = id
  }
}

const now = () => new Date().toISOString()

type Split = {
  /** The source row, released and cut to the part. */
  released: LocalSetAside
  /** What stays live, when only part of the row went. */
  remainder: LocalSetAside | null
  item: ReleaseItemWire
}

/**
 * What a release records on the row. `carriedBy` is the transfer that took the money off, when
 * one did; otherwise the row keeps the one that brought it, as the server keeps it.
 */
type Release = { releasedById: string | null; carriedBy?: string | null }

/** Release `part` of a live row on `on`; the rest, if any, stays live under a new id. */
function split(
  row: LocalSetAside,
  part: SetAsidePart,
  on: string,
  release: Release,
  ts: string,
): Split {
  const amount = part.amount ?? row.amount
  const partial = amount > 0 && amount < row.amount
  const released: LocalSetAside = {
    ...row,
    amount: partial ? amount : row.amount,
    releasedAt: on,
    releasedById: release.releasedById,
    movedByTransferId: release.carriedBy ?? row.movedByTransferId,
    updatedAt: ts,
    dirty: 1,
  }
  if (!partial) return { released, remainder: null, item: { id: row.id } }
  const remainderId = newId()
  return {
    released,
    remainder: {
      ...row,
      id: remainderId,
      amount: row.amount - amount,
      createdAt: ts,
      updatedAt: ts,
      version: '',
      dirty: 1,
      deleted: 0,
    },
    item: { id: row.id, amount, remainder_id: remainderId },
  }
}

async function liveRows(
  parts: ReadonlyArray<SetAsidePart>,
): Promise<LocalSetAside[]> {
  const rows = await db.setAsides.bulkGet(parts.map((p) => p.id))
  return rows.map((row, i) => {
    if (!row || !isLiveSetAside(row)) throw new SetAsideBatchError(parts[i].id)
    return row
  })
}

/**
 * Write the batch's rows and queue it. The entry is keyed by its first source and holds every
 * row it writes — sources, remainders, new rows — so no write to any of them overtakes it.
 */
async function queueBatch(
  op: Extract<OutboxOp, 'release' | 'move'>,
  rows: ReadonlyArray<LocalSetAside>,
  payload: ReleaseWire | MoveWire,
): Promise<void> {
  await db.setAsides.bulkPut([...rows])
  const [first, ...rest] = rows.map((r) => r.id)
  await db.outbox.add({
    op,
    entity: 'setAside',
    id: first,
    alsoRows: rest,
    payload,
    baseVersion: null,
    createdAt: now(),
  })
}

/** Consecutive runs of at most `limits.setAsideBatchMax` items. */
function chunks<T>(items: ReadonlyArray<T>): T[][] {
  const size = Math.max(1, configLimits().setAsideBatchMax)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

/**
 * Release set-asides — wholly, or in part. `releasedById` names the transaction that used
 * them — a payment, or the transfer leg that carried a leftover to one (it must be one of the
 * user's transactions). Throws `SetAsideBatchError` for a row that is not live; nothing is
 * written then.
 */
export async function releaseSetAsides(
  parts: ReadonlyArray<SetAsidePart>,
  options: { releasedAt?: string; releasedById?: string | null } = {},
): Promise<void> {
  if (parts.length === 0) return
  const releasedAt = options.releasedAt ?? isoOf(new Date())
  const releasedById = options.releasedById ?? null
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    const ts = now()
    const splits = (await liveRows(parts)).map((row, i) =>
      split(row, parts[i], releasedAt, { releasedById }, ts),
    )
    for (const chunk of chunks(splits)) {
      await queueBatch(
        'release',
        chunk.flatMap((s) =>
          s.remainder ? [s.released, s.remainder] : [s.released],
        ),
        {
          released_at: releasedAt,
          ...(releasedById ? { released_by_id: releasedById } : {}),
          items: chunk.map((s) => s.item),
        },
      )
    }
  })
  schedulePush()
}

type NewOwner = Pick<LocalSetAside, 'goalId' | 'billId' | 'occurrence'>

/** What a move names for its owner on the wire: a bill's occurrence only when one was asked for. */
const ownerWire = (owner: SetAsideOwner): MoveTargetWire =>
  'goalId' in owner
    ? { goal_id: owner.goalId }
    : {
        bill_id: owner.billId,
        ...(owner.occurrence ? { occurrence: owner.occurrence } : {}),
      }

/**
 * The owner a moved row lands on, or null when the move keeps the source's — no owner named,
 * or the source's own goal, or its own bill and occurrence. Keeping the owner keeps the planned
 * link; another owner (another occurrence included) drops it. A bill target covers the
 * occurrence named, else the source's on the same bill, else the bill's `nextDue`.
 */
async function ownerAfterMove(
  source: LocalSetAside,
  owner: SetAsideOwner | undefined,
): Promise<NewOwner | null> {
  if (!owner) return null
  if ('goalId' in owner) {
    if (owner.goalId === source.goalId) return null
    return { goalId: owner.goalId, billId: null, occurrence: null }
  }
  const sameBill = owner.billId === source.billId
  const occurrence =
    owner.occurrence ??
    (sameBill
      ? source.occurrence
      : ((await db.bills.get(owner.billId))?.nextDue ?? null))
  if (sameBill && occurrence === source.occurrence) return null
  return { goalId: null, billId: owner.billId, occurrence }
}

/**
 * A move's new row: the source's money, now for the target. A move that keeps the owner names
 * only the wallet on the wire, so the server keeps the planned link exactly as this row does.
 */
async function movedCopy(
  source: LocalSetAside,
  amount: number,
  to: MoveTarget,
  date: string,
  transferId: string | null,
  ts: string,
): Promise<{ row: LocalSetAside; to: MoveTargetWire }> {
  const owner = await ownerAfterMove(source, to.owner)
  const toWire: MoveTargetWire = {
    ...(owner && to.owner ? ownerWire(to.owner) : {}),
    ...(to.walletId ? { wallet_id: to.walletId } : {}),
  }
  return {
    // A move naming nothing but its own owner still has to name something.
    to:
      Object.keys(toWire).length === 0 && to.owner
        ? ownerWire(to.owner)
        : toWire,
    row: {
      ...source,
      id: newId(),
      ...(owner ?? {}),
      ...(to.walletId
        ? {
            source: 'wallet' as const,
            walletId: to.walletId,
            externalLabel: null,
          }
        : {}),
      amount,
      date,
      plannedId: owner ? null : source.plannedId,
      releasedAt: null,
      releasedById: null,
      movedByTransferId: transferId,
      createdAt: ts,
      updatedAt: ts,
      version: '',
      dirty: 1,
      deleted: 0,
    },
  }
}

/**
 * Move set-asides — wholly or in part — to another wallet and/or another bill or goal. The
 * source is released on `date` (default today) and a new row written for the target, dated
 * `date`; `transferId` (the transfer the money rode on, possibly still queued) is stamped on
 * both — without one, the source keeps the transfer that brought it. Throws `SetAsideBatchError` for a row that is not live; nothing is written then.
 */
export async function moveSetAsides(
  parts: ReadonlyArray<MovePart>,
  options: { date?: string; transferId?: string | null } = {},
): Promise<void> {
  if (parts.length === 0) return
  const date = options.date ?? isoOf(new Date())
  const transferId = options.transferId ?? null
  await db.transaction('rw', db.setAsides, db.bills, db.outbox, async () => {
    const ts = now()
    const moves: { rows: LocalSetAside[]; item: MoveItemWire }[] = []
    const sources = await liveRows(parts)
    for (const [i, source] of sources.entries()) {
      const part = parts[i]
      const s = split(
        source,
        part,
        date,
        { releasedById: null, carriedBy: transferId },
        ts,
      )
      const copy = await movedCopy(
        source,
        s.released.amount,
        part.to,
        date,
        transferId,
        ts,
      )
      moves.push({
        rows: [s.released, ...(s.remainder ? [s.remainder] : []), copy.row],
        item: { ...s.item, new_id: copy.row.id, to: copy.to },
      })
    }
    for (const chunk of chunks(moves)) {
      await queueBatch(
        'move',
        chunk.flatMap((mv) => mv.rows),
        {
          date,
          ...(transferId ? { transfer_id: transferId } : {}),
          items: chunk.map((mv) => mv.item),
        },
      )
    }
  })
  schedulePush()
}
