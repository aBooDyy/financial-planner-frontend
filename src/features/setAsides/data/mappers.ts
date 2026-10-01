import type { LocalSetAside } from '#/db/types'
import type {
  CreateSetAsideWire,
  SetAside,
  UpdateSetAsideWire,
} from '#/features/setAsides/api/types'
import { toWireSetAsideSource } from '#/features/setAsides/api/types'

/** Server set-aside → local record (freshly synced: clean, not deleted). */
export const serverSetAsideToLocal = (a: SetAside): LocalSetAside => ({
  ...a,
  dirty: 0,
  deleted: 0,
})

const setAsideBody = (
  l: LocalSetAside,
): Omit<CreateSetAsideWire, 'id' | 'goal_id' | 'bill_id'> => ({
  occurrence: l.occurrence,
  source: toWireSetAsideSource(l.source),
  wallet_id: l.source === 'wallet' ? l.walletId : null,
  external_label: l.source === 'outside' ? l.externalLabel : null,
  amount: l.amount,
  currency: l.currency,
  note: l.note,
  position: l.position,
  date: l.date,
  planned_id: l.plannedId,
  released_at: l.releasedAt,
  released_by_id: l.releasedAt ? l.releasedById : null,
  moved_by_transfer_id: l.movedByTransferId,
})

export const localSetAsideToCreateWire = (
  l: LocalSetAside,
): CreateSetAsideWire => ({
  id: l.id,
  goal_id: l.goalId,
  bill_id: l.billId,
  ...setAsideBody(l),
})

// The update is based on the last-synced `version` (optimistic locking base).
export const localSetAsideToUpdateWire = (
  l: LocalSetAside,
): UpdateSetAsideWire => ({
  version: l.version,
  ...setAsideBody(l),
})
