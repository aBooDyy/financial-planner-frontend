import { fromWireCurrency } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/**
 * `wallet`: the money stays in one of the user's wallets, labelled. `outside`: it is held
 * somewhere the app does not track, named by `externalLabel`.
 */
export type SetAsideSource = 'wallet' | 'outside'
export type SetAsideSourceWire = 'WALLET' | 'OUTSIDE'

const SOURCE_TO_WIRE: Record<SetAsideSource, SetAsideSourceWire> = {
  wallet: 'WALLET',
  outside: 'OUTSIDE',
}
const SOURCE_FROM_WIRE: Record<SetAsideSourceWire, SetAsideSource> = {
  WALLET: 'wallet',
  OUTSIDE: 'outside',
}

export const toWireSetAsideSource = (s: SetAsideSource): SetAsideSourceWire =>
  SOURCE_TO_WIRE[s]
export const fromWireSetAsideSource = (w: SetAsideSourceWire): SetAsideSource =>
  SOURCE_FROM_WIRE[w]

// --- Domain (camelCase) --------------------------------------------------------------

/**
 * Money labelled for a bill or a goal (exactly one), in its real wallet. Live while
 * `releasedAt` is null; a row is always wholly live or wholly released.
 */
export type SetAside = {
  id: string
  goalId: string | null
  billId: string | null
  /** A bill's: the due date of the occurrence it covers. Null for a goal. */
  occurrence: string | null
  source: SetAsideSource
  /** `wallet` only (null once that wallet was deleted). */
  walletId: string | null
  /** `outside` only. */
  externalLabel: string | null
  amount: number
  currency: CurrencyCode
  note: string | null
  position: number
  /** When it was set aside. */
  date: string
  /** The planned SET_ASIDE row it settles. */
  plannedId: string | null
  releasedAt: string | null
  /** The payment (transaction) that released it. */
  releasedById: string | null
  /** The transfer a move rode on, stamped on both the released row and the new one. */
  movedByTransferId: string | null
  createdAt: string
  updatedAt: string
  version: string
}

// --- Wire (snake_case) ---------------------------------------------------------------

export type SetAsideWire = {
  id: string
  goal_id: string | null
  bill_id: string | null
  occurrence: string | null
  source: SetAsideSourceWire
  wallet_id: string | null
  external_label: string | null
  amount: number
  currency: string
  note: string | null
  position: number
  date: string
  planned_id: string | null
  released_at: string | null
  released_by_id: string | null
  moved_by_transfer_id: string | null
  created_at: string
  updated_at: string
  version: string
}

export type CreateSetAsideWire = {
  id: string
  goal_id: string | null
  bill_id: string | null
  occurrence: string | null
  source: SetAsideSourceWire
  wallet_id: string | null
  external_label: string | null
  amount: number
  currency: string
  note: string | null
  position: number
  date: string
  planned_id: string | null
  released_at: string | null
  released_by_id: string | null
  moved_by_transfer_id: string | null
}

/** The owner (`goal_id` / `bill_id`) is fixed at create, so it is not sent. */
export type UpdateSetAsideWire = Omit<
  CreateSetAsideWire,
  'id' | 'goal_id' | 'bill_id'
> & { version: string }

// --- Mappers (wire → domain) ---------------------------------------------------------

export const toSetAside = (w: SetAsideWire): SetAside => ({
  id: w.id,
  goalId: w.goal_id,
  billId: w.bill_id,
  occurrence: w.occurrence ?? null,
  source: fromWireSetAsideSource(w.source),
  walletId: w.wallet_id ?? null,
  externalLabel: w.external_label ?? null,
  amount: w.amount,
  currency: fromWireCurrency(w.currency),
  note: w.note ?? null,
  position: w.position,
  date: w.date,
  plannedId: w.planned_id ?? null,
  releasedAt: w.released_at ?? null,
  releasedById: w.released_by_id ?? null,
  movedByTransferId: w.moved_by_transfer_id ?? null,
  createdAt: w.created_at,
  updatedAt: w.updated_at,
  version: w.version,
})

// --- Closing a bill or goal (`POST /bills/{id}/close`, `POST /goals/{id}/close`) -------

/** Where a closed item's live set-asides go: freed, or moved to another open bill or goal. */
export type LeftoverWire = 'FREE' | 'MOVE'

export type LeftoverTargetWire = {
  goal_id?: string
  bill_id?: string
  /** A bill target only; defaults to its `next_due`. */
  occurrence?: string
  /** Source set-aside id → the id its moved copy takes, minted here so it exists offline. */
  new_ids?: Record<string, string>
}

/** Carries no `version`: the push adds the row's last-synced one when it goes out. */
export type CloseWire = {
  closed_at: string
  leftover: LeftoverWire
  move_to?: LeftoverTargetWire
}

/** What a close released and (with MOVE) wrote again for the target. */
export type CloseEffectWire = {
  released: SetAsideWire[]
  created: SetAsideWire[]
}

// --- Batches (`POST /set-asides/release`, `POST /set-asides/move`) ----------------------

/**
 * One row to release: whole, or — with an `amount` below the row's — split, the rest staying
 * live under `remainder_id`.
 */
export type ReleaseItemWire = {
  id: string
  amount?: number
  remainder_id?: string
}

export type ReleaseWire = {
  released_at: string
  released_by_id?: string
  items: ReleaseItemWire[]
}

/** Where a moved part goes; anything left out keeps the source's. */
export type MoveTargetWire = {
  wallet_id?: string
  goal_id?: string
  bill_id?: string
  /** With `bill_id` only. */
  occurrence?: string
}

export type MoveItemWire = ReleaseItemWire & {
  new_id: string
  to: MoveTargetWire
}

export type MoveWire = {
  date: string
  transfer_id?: string
  items: MoveItemWire[]
}

/** The source rows, now released (item order), then remainders, then (move) the new rows. */
export type SetAsideBatchWire = {
  released: SetAsideWire[]
  created: SetAsideWire[]
}

export type SetAsideBatch = {
  released: SetAside[]
  created: SetAside[]
}

export const toSetAsideBatch = (w: SetAsideBatchWire): SetAsideBatch => ({
  released: w.released.map(toSetAside),
  created: w.created.map(toSetAside),
})
