/**
 * What closing a bill or goal does to the money still set aside for it, applied on this device
 * exactly as the server applies it in the same close: every live set-aside is released on the
 * close date, and with "move" each is written again for the target (same wallet or label,
 * amount, note and position; dated the close date; no planned link). The moved copies take ids
 * minted here, which the close sends as `new_ids` so the server's rows are these rows.
 *
 * The rows are marked dirty — their change rides on the close, not on outbox entries of their
 * own — so a pull cannot undo them before the close lands.
 */
import { db } from '#/db/db'
import type { LocalSetAside } from '#/db/types'
import { dropOpenPlannedAfter } from '#/features/planned/data/rows'
import type { CloseWire } from '#/features/setAsides/api/types'
import { configLimits } from '#/lib/config/appConfig'
import { newId } from '#/lib/uuid'
import { moveSetAsides, releaseSetAsides } from './batches'
import type { SetAsideOwner } from './mutations'
import { isLiveSetAside } from './totals'

export type Leftover = { kind: 'free' } | { kind: 'move'; to: SetAsideOwner }

type Closing = { goalId: string } | { billId: string }

const now = () => new Date().toISOString()

const ownedBy = async (owner: Closing): Promise<LocalSetAside[]> =>
  'goalId' in owner
    ? db.setAsides.where('goalId').equals(owner.goalId).toArray()
    : db.setAsides.where('billId').equals(owner.billId).toArray()

async function targetOccurrence(to: SetAsideOwner): Promise<string | null> {
  if ('goalId' in to) return null
  if (to.occurrence) return to.occurrence
  return (await db.bills.get(to.billId))?.nextDue ?? null
}

/** Release (and maybe move) the closing item's live set-asides; returns the close's leftover. */
export async function applyLeftoverLocally(
  closing: Closing,
  closedAt: string,
  leftover: Leftover,
): Promise<Pick<CloseWire, 'leftover' | 'move_to'>> {
  return db.transaction('rw', db.setAsides, db.bills, async () => {
    const ts = now()
    const live = (await ownedBy(closing)).filter(isLiveSetAside)
    for (const row of live) {
      await db.setAsides.put({
        ...row,
        releasedAt: closedAt,
        releasedById: null,
        updatedAt: ts,
        dirty: 1,
      })
    }
    if (leftover.kind === 'free') return { leftover: 'FREE' as const }

    const to = leftover.to
    const occurrence = await targetOccurrence(to)
    const newIds: Record<string, string> = {}
    for (const row of live) {
      const id = newId()
      newIds[row.id] = id
      await db.setAsides.put({
        ...row,
        id,
        goalId: 'goalId' in to ? to.goalId : null,
        billId: 'billId' in to ? to.billId : null,
        occurrence,
        date: closedAt,
        plannedId: null,
        releasedAt: null,
        releasedById: null,
        movedByTransferId: null,
        createdAt: ts,
        updatedAt: ts,
        version: '',
        dirty: 1,
        deleted: 0,
      })
    }
    return {
      leftover: 'MOVE' as const,
      move_to: {
        ...('goalId' in to ? { goal_id: to.goalId } : { bill_id: to.billId }),
        ...('billId' in to && to.occurrence
          ? { occurrence: to.occurrence }
          : {}),
        new_ids: newIds,
      },
    }
  })
}

/**
 * The server refuses to close an item holding more live set-asides than one batch takes
 * (`planning.close.too_many_set_asides`). The ones beyond that are freed or moved first, in
 * batches of their own queued ahead of the close, on the close date — as the close would have.
 */
async function sendOverflowAhead(
  closing: Closing,
  closedAt: string,
  leftover: Leftover,
): Promise<void> {
  const cap = Math.max(1, configLimits().setAsideBatchMax)
  const overflow = (await ownedBy(closing))
    .filter(isLiveSetAside)
    .slice(cap)
    .map((a) => ({ id: a.id }))
  if (overflow.length === 0) return
  if (leftover.kind === 'free')
    await releaseSetAsides(overflow, { releasedAt: closedAt })
  else
    await moveSetAsides(
      overflow.map((part) => ({ ...part, to: { owner: leftover.to } })),
      { date: closedAt },
    )
}

/**
 * Mark a bill or goal done on this device, as the server's close does it in one go: write the
 * item's own change (`markClosed`), release (and maybe move) its set-asides, drop its open
 * unsettled planned rows after the close date, and queue the close. One Dexie transaction, so
 * a failure leaves nothing half-closed — after any overflow beyond the server's cap went ahead.
 */
export async function queueClose(
  item: { entity: 'bill'; id: string } | { entity: 'goal'; id: string },
  closedAt: string,
  leftover: Leftover,
  markClosed: () => Promise<void>,
): Promise<void> {
  const owner =
    item.entity === 'bill' ? { billId: item.id } : { goalId: item.id }
  await sendOverflowAhead(owner, closedAt, leftover)
  await db.transaction(
    'rw',
    [
      db.bills,
      db.goals,
      db.setAsides,
      db.plannedTransactions,
      db.transactions,
      db.outbox,
    ],
    async () => {
      await markClosed()
      const effect = await applyLeftoverLocally(owner, closedAt, leftover)
      await dropOpenPlannedAfter(
        item.entity === 'bill' ? 'billId' : 'goalId',
        item.id,
        closedAt,
      )
      await db.outbox.add({
        op: 'close',
        entity: item.entity,
        id: item.id,
        payload: { closed_at: closedAt, ...effect } satisfies CloseWire,
        baseVersion: null,
        createdAt: now(),
      })
    },
  )
}
