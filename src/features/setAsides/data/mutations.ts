/**
 * Local-first writes of set-asides: the Dexie row and its outbox entry in one transaction,
 * then a push. A set-aside can settle a planned row (`plannedId`), so every write re-derives
 * that row's status the way every other settlement does (`planned/data/rows`).
 */
import { db } from '#/db/db'
import {
  enqueueCreate,
  enqueueDelete,
  enqueueUpsert,
  pendingFor,
} from '#/db/enqueue'
import { schedulePush } from '#/db/sync'
import type { LocalSetAside } from '#/db/types'
import type { SetAsideSource } from '#/features/setAsides/api/types'
import { closeCovered, reopenUnderSettled } from '#/features/planned/data/rows'
import type { CurrencyCode } from '#/lib/currency'
import { isoOf } from '#/features/planned/data/dates'
import { newId } from '#/lib/uuid'
import { localSetAsideToCreateWire, localSetAsideToUpdateWire } from './mappers'
import { touchedByBatch } from './queue'

/** Exactly one owner: a goal, or a bill and (optionally) the occurrence it covers. */
export type SetAsideOwner =
  | { goalId: string }
  | { billId: string; occurrence?: string | null }

export type SetAsideDraft = {
  /** A caller-chosen id makes the create idempotent: an id already held writes nothing. */
  id?: string
  source: SetAsideSource
  /** Read only for a `wallet` set-aside. */
  walletId: string | null
  /** Read only for an `outside` set-aside. */
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  /** When it was set aside; a new one defaults to today. */
  date?: string
  /** The planned set-aside it settles. Undefined on update leaves the link alone. */
  plannedId?: string | null
}

/** A change to an existing set-aside; the owner is fixed at create. */
export type SetAsidePatch = Partial<Omit<SetAsideDraft, 'id'>> & {
  occurrence?: string | null
}

const now = () => new Date().toISOString()

/** A wallet set-aside never keeps a label, and an outside one never keeps a wallet. */
const sourced = (
  d: Pick<SetAsideDraft, 'source' | 'walletId' | 'externalLabel'>,
): Pick<LocalSetAside, 'source' | 'walletId' | 'externalLabel'> =>
  d.source === 'wallet'
    ? { source: 'wallet', walletId: d.walletId, externalLabel: null }
    : { source: 'outside', walletId: null, externalLabel: d.externalLabel }

async function nextPosition(owner: SetAsideOwner): Promise<number> {
  const rows =
    'goalId' in owner
      ? await db.setAsides.where('goalId').equals(owner.goalId).toArray()
      : await db.setAsides.where('billId').equals(owner.billId).toArray()
  return (
    rows
      .filter((a) => a.deleted === 0)
      .reduce((max, a) => Math.max(max, a.position), -1) + 1
  )
}

/** A bill's set-aside covers an occurrence; with none named it is the bill's next one. */
async function occurrenceFor(owner: SetAsideOwner): Promise<string | null> {
  if ('goalId' in owner) return null
  if (owner.occurrence) return owner.occurrence
  return (await db.bills.get(owner.billId))?.nextDue ?? null
}

export async function createSetAside(
  owner: SetAsideOwner,
  draft: SetAsideDraft,
): Promise<string> {
  const id = draft.id ?? newId()
  if (draft.id && (await db.setAsides.get(draft.id))) return id
  const ts = now()
  const row: LocalSetAside = {
    id,
    goalId: 'goalId' in owner ? owner.goalId : null,
    billId: 'billId' in owner ? owner.billId : null,
    occurrence: await occurrenceFor(owner),
    ...sourced(draft),
    amount: draft.amount,
    currency: draft.currency,
    note: draft.note,
    position: await nextPosition(owner),
    date: draft.date ?? isoOf(new Date()),
    plannedId: draft.plannedId ?? null,
    releasedAt: null,
    releasedById: null,
    movedByTransferId: null,
    createdAt: ts,
    updatedAt: ts,
    // Placeholder until the first sync returns the server's sha256 version.
    version: '',
    dirty: 1,
    deleted: 0,
  }
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.setAsides.put(row)
    await enqueueCreate('setAside', id, localSetAsideToCreateWire(row))
  })
  await closeCovered([row.plannedId])
  schedulePush()
  return id
}

export async function updateSetAside(
  id: string,
  patch: SetAsidePatch,
): Promise<void> {
  const existing = await db.setAsides.get(id)
  if (!existing || existing.deleted !== 0) return
  const row: LocalSetAside = {
    ...existing,
    ...sourced({
      source: patch.source ?? existing.source,
      walletId:
        patch.walletId !== undefined ? patch.walletId : existing.walletId,
      externalLabel:
        patch.externalLabel !== undefined
          ? patch.externalLabel
          : existing.externalLabel,
    }),
    occurrence:
      existing.billId && patch.occurrence !== undefined
        ? patch.occurrence
        : existing.occurrence,
    amount: patch.amount ?? existing.amount,
    currency: patch.currency ?? existing.currency,
    note: patch.note !== undefined ? patch.note : existing.note,
    date: patch.date ?? existing.date,
    plannedId:
      patch.plannedId !== undefined ? patch.plannedId : existing.plannedId,
    updatedAt: now(),
    dirty: 1,
  }
  await writeUpdate(row)
  await reopenUnderSettled([existing.plannedId])
  await closeCovered([row.plannedId])
  schedulePush()
}

/**
 * Take back a release: the same row is live again, so the money is never counted both as set
 * aside and as used. A partial release only ever released its own part, so that part is what
 * comes back — the remainder it split off stayed live all along.
 */
export async function unreleaseSetAside(id: string): Promise<void> {
  const existing = await db.setAsides.get(id)
  if (!existing || existing.deleted !== 0 || existing.releasedAt === null)
    return
  const row: LocalSetAside = {
    ...existing,
    releasedAt: null,
    releasedById: null,
    updatedAt: now(),
    dirty: 1,
  }
  await writeUpdate(row)
  await closeCovered([row.plannedId])
  schedulePush()
}

async function writeUpdate(row: LocalSetAside): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await db.setAsides.put(row)
    if (await touchedByBatch(row.id)) {
      // Folding this edit into a write queued before the batch would send the batch's own
      // effect ahead of it; it goes after instead.
      await enqueueUpdateAfter(row)
      return
    }
    await enqueueUpsert(
      'setAside',
      row.id,
      row.version,
      localSetAsideToCreateWire(row),
      localSetAsideToUpdateWire(row),
    )
  })
}

async function enqueueUpdateAfter(row: LocalSetAside): Promise<void> {
  await db.outbox.add({
    op: 'update',
    entity: 'setAside',
    id: row.id,
    payload: localSetAsideToUpdateWire(row),
    baseVersion: row.version,
    createdAt: now(),
  })
}

/**
 * Remove a set-aside made by mistake. Releasing — not deleting — is how money stops being set
 * aside: a release keeps the record of it.
 */
export async function deleteSetAside(id: string): Promise<void> {
  const plannedId = (await db.setAsides.get(id))?.plannedId
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    await enqueueDelete('setAside', id)
    await db.setAsides.delete(id)
  })
  await reopenUnderSettled([plannedId])
  schedulePush()
}

/**
 * A deleted bill or goal takes its set-asides with it, as the server cascades. Their queued
 * writes go in the same transaction — a queued create would otherwise reach the server after
 * its owner is gone and be refused forever. Nothing is queued: the owner's delete covers it.
 */
export async function dropSetAsidesOf(
  link: 'goalId' | 'billId',
  ownerId: string,
): Promise<void> {
  await db.transaction('rw', db.setAsides, db.outbox, async () => {
    const rows = await db.setAsides.where(link).equals(ownerId).toArray()
    for (const row of rows) {
      await pendingFor('setAside', row.id).delete()
      await db.setAsides.delete(row.id)
    }
  })
}
