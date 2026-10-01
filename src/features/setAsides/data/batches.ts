/**
 * Releasing and moving set-asides — "Free it up", a payment releasing what it used, "move them
 * with the transfer", "Move to…" another bill or goal. Each is applied here at once and queued
 * as **one** batch entry the server applies all-or-nothing (`/set-asides/release`, `/move`).
 *
 * Every row stays wholly live or wholly released: a part smaller than a row releases the row
 * with its amount cut to the part and writes the rest as a new live row (the remainder). Ids of
 * remainders and moved rows are minted here and sent with the batch, so they exist offline and
 * the server's rows are these rows. The touched rows are marked dirty; the batch carries them.
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
import { newId } from '#/lib/uuid'
import type { SetAsideOwner } from './mutations'
import { isLiveSetAside } from './totals'

/** One row to act on, whole or — with a smaller `amount`, in the row's currency — in part. */
export type SetAsidePart = { id: string; amount?: number }

export type MoveTarget = {
  /** Into another wallet (it becomes a wallet set-aside). */
  walletId?: string
  /** For another bill or goal; the planned link is dropped. */
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

/** Release `part` of a live row on `on`; the rest, if any, stays live under a new id. */
function split(
  row: LocalSetAside,
  part: SetAsidePart,
  on: string,
  release: Pick<LocalSetAside, 'releasedById' | 'movedByTransferId'>,
  ts: string,
): Split {
  const amount = part.amount ?? row.amount
  const partial = amount > 0 && amount < row.amount
  const released: LocalSetAside = {
    ...row,
    amount: partial ? amount : row.amount,
    releasedAt: on,
    ...release,
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

/**
 * Release set-asides — wholly, or in part. `releasedById` names the payment that released
 * them (it must be one of the user's transactions). Throws `SetAsideBatchError` for a row that
 * is not live; nothing is written then.
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
      split(
        row,
        parts[i],
        releasedAt,
        { releasedById, movedByTransferId: null },
        ts,
      ),
    )
    await queueBatch(
      'release',
      splits.flatMap((s) =>
        s.remainder ? [s.released, s.remainder] : [s.released],
      ),
      {
        released_at: releasedAt,
        ...(releasedById ? { released_by_id: releasedById } : {}),
        items: splits.map((s) => s.item),
      },
    )
  })
  schedulePush()
}

/** A move's new row: the source's money, now for the target. */
async function movedCopy(
  source: LocalSetAside,
  amount: number,
  to: MoveTarget,
  date: string,
  transferId: string | null,
  ts: string,
): Promise<{ row: LocalSetAside; to: MoveTargetWire }> {
  const owner = to.owner
  const sameOwner =
    !owner ||
    ('goalId' in owner
      ? owner.goalId === source.goalId
      : owner.billId === source.billId)
  const toWire: MoveTargetWire = {}
  let occurrence = source.occurrence
  if (owner && 'goalId' in owner) {
    toWire.goal_id = owner.goalId
    occurrence = null
  } else if (owner) {
    toWire.bill_id = owner.billId
    if (owner.occurrence) toWire.occurrence = owner.occurrence
    occurrence =
      owner.occurrence ??
      (owner.billId === source.billId
        ? source.occurrence
        : ((await db.bills.get(owner.billId))?.nextDue ?? null))
  }
  if (to.walletId) toWire.wallet_id = to.walletId
  return {
    to: toWire,
    row: {
      ...source,
      id: newId(),
      goalId: owner ? ('goalId' in owner ? owner.goalId : null) : source.goalId,
      billId: owner ? ('billId' in owner ? owner.billId : null) : source.billId,
      occurrence,
      ...(to.walletId
        ? {
            source: 'wallet' as const,
            walletId: to.walletId,
            externalLabel: null,
          }
        : {}),
      amount,
      date,
      plannedId: sameOwner ? source.plannedId : null,
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
 * both. Throws `SetAsideBatchError` for a row that is not live; nothing is written then.
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
    const rows: LocalSetAside[] = []
    const items: MoveItemWire[] = []
    const sources = await liveRows(parts)
    for (const [i, source] of sources.entries()) {
      const part = parts[i]
      const s = split(
        source,
        part,
        date,
        { releasedById: null, movedByTransferId: transferId },
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
      rows.push(s.released, ...(s.remainder ? [s.remainder] : []), copy.row)
      items.push({ ...s.item, new_id: copy.row.id, to: copy.to })
    }
    await queueBatch('move', rows, {
      date,
      ...(transferId ? { transfer_id: transferId } : {}),
      items,
    })
  })
  schedulePush()
}
