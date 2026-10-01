import type { LocalPlanned } from '#/db/types'
import type {
  CreatePlannedWire,
  Planned,
  UpdatePlannedWire,
} from '#/features/planned/api/types'
import {
  toWireOrigin,
  toWirePlannedStatus,
  toWireRole,
} from '#/features/planned/api/types'

export const serverPlannedToLocal = (p: Planned): LocalPlanned => ({
  ...p,
  dirty: 0,
  deleted: 0,
})

export const localPlannedToCreateWire = (
  l: LocalPlanned,
): CreatePlannedWire => ({
  id: l.id,
  origin: toWireOrigin(l.origin),
  role: toWireRole(l.role),
  goal_id: l.goalId,
  income_stream_id: l.incomeStreamId,
  bill_id: l.billId,
  wallet_id: l.walletId,
  name: l.name,
  amount: l.amount,
  currency: l.currency,
  category_id: l.categoryId,
  occurrence: l.occurrence,
  date: l.date,
  status: toWirePlannedStatus(l.status),
  pinned: l.pinned,
  review: l.review,
  note: l.note,
})

export const localPlannedToUpdateWire = (
  l: LocalPlanned,
): UpdatePlannedWire => ({
  version: l.version,
  amount: l.amount,
  date: l.date,
  wallet_id: l.walletId,
  status: toWirePlannedStatus(l.status),
  pinned: l.pinned,
  review: l.review,
  note: l.note,
  name: l.name,
  category_id: l.categoryId,
})
