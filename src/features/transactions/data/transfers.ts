import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import type { LocalTransaction } from '#/db/types'
import type { CurrencyCode } from '#/lib/currency'
import type { TransferLegType } from '#/features/transactions/api/types'
import { transferToCreateWire, transferToUpdateWire } from './mappers'
import type { HeldLegs, TransferLegs } from './mappers'

export type TransferDraft = {
  fromWalletId: string
  toWalletId: string
  /** Minor units in the source wallet's currency. */
  amount: number
  fromCurrency: CurrencyCode
  /** Minor units in the destination wallet's currency — equal to `amount` within one currency. */
  toAmount: number
  toCurrency: CurrencyCode
  date: string
  note: string | null
}

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

const pendingFor = (transferId: string) =>
  db.outbox.where('[entity+id]').equals(['transfer', transferId])

export async function heldLegs(transferId: string): Promise<HeldLegs> {
  const rows = await db.transactions
    .where('transferId')
    .equals(transferId)
    .toArray()
  return {
    out: rows.find((r) => r.type === 'transfer_out'),
    in: rows.find((r) => r.type === 'transfer_in'),
  }
}

const bothLegs = (legs: HeldLegs): legs is TransferLegs =>
  legs.out !== undefined && legs.in !== undefined

const buildLeg = (
  id: string,
  transferId: string,
  type: TransferLegType,
  walletId: string,
  amount: number,
  currency: CurrencyCode,
  draft: TransferDraft,
  ts: string,
): LocalTransaction => ({
  id,
  type,
  amount,
  currency,
  category: null,
  subcategory: null,
  walletId,
  goalId: null,
  merchantId: null,
  date: draft.date,
  note: draft.note,
  source: null,
  transferId,
  plannedId: null,
  createdAt: ts,
  updatedAt: ts,
  version: '',
  dirty: 1,
  deleted: 0,
})

const legsFor = (
  transferId: string,
  outId: string,
  inId: string,
  draft: TransferDraft,
  ts: string,
): TransferLegs => ({
  out: buildLeg(
    outId,
    transferId,
    'transfer_out',
    draft.fromWalletId,
    draft.amount,
    draft.fromCurrency,
    draft,
    ts,
  ),
  in: buildLeg(
    inId,
    transferId,
    'transfer_in',
    draft.toWalletId,
    draft.toAmount,
    draft.toCurrency,
    draft,
    ts,
  ),
})

export async function createTransfer(draft: TransferDraft): Promise<string> {
  const transferId = newId()
  const ts = now()
  const legs = legsFor(transferId, newId(), newId(), draft, ts)
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    await db.transactions.bulkPut([legs.out, legs.in])
    await db.outbox.add({
      op: 'create',
      entity: 'transfer',
      id: transferId,
      payload: transferToCreateWire(transferId, legs),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return transferId
}

/**
 * Rewrites the legs still held. A lone leg keeps its side: an OUT leg takes the source half
 * of the draft, an IN leg the destination half.
 */
export async function updateTransfer(
  transferId: string,
  draft: TransferDraft,
): Promise<void> {
  const ts = now()
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    const existing = await heldLegs(transferId)
    if (!existing.out && !existing.in) return
    const fresh = legsFor(
      transferId,
      existing.out?.id ?? '',
      existing.in?.id ?? '',
      draft,
      ts,
    )
    const keep = (
      leg: LocalTransaction,
      prior: LocalTransaction | undefined,
    ): LocalTransaction | undefined =>
      prior && { ...leg, createdAt: prior.createdAt, version: prior.version }
    const legs: HeldLegs = {
      out: keep(fresh.out, existing.out),
      in: keep(fresh.in, existing.in),
    }
    await db.transactions.bulkPut(
      [legs.out, legs.in].filter((l) => l !== undefined),
    )

    const entries = await pendingFor(transferId).toArray()
    const create = entries.find((e) => e.op === 'create')
    if (create && bothLegs(legs)) {
      create.payload = transferToCreateWire(transferId, legs)
      await db.outbox.put(create)
      return
    }
    const update = entries.find((e) => e.op === 'update')
    if (update) {
      update.payload = transferToUpdateWire(legs)
      await db.outbox.put(update)
      return
    }
    await db.outbox.add({
      op: 'update',
      entity: 'transfer',
      id: transferId,
      payload: transferToUpdateWire(legs),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
}

/** Removes every leg held locally; the server is told only if it ever heard of the transfer. */
export async function deleteTransfer(transferId: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.outbox, async () => {
    const entries = await pendingFor(transferId).toArray()
    const neverSynced = entries.some((e) => e.op === 'create')
    await pendingFor(transferId).delete()
    await db.transactions.where('transferId').equals(transferId).delete()
    if (neverSynced) return
    await db.outbox.add({
      op: 'delete',
      entity: 'transfer',
      id: transferId,
      payload: null,
      baseVersion: null,
      createdAt: now(),
    })
  })
  schedulePush()
}
