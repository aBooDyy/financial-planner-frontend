import type {
  LocalBill,
  LocalIncomeStream,
  LocalMerchantAlias,
  LocalTransaction,
  OutboxEntry,
} from '#/db/types'

/**
 * The planning half of adopt-and-remap (`sync.ts` applies it).
 *
 * When `POST /merchants` is refused with `409 merchants.alias.taken`, nothing was written:
 * the temp merchant does not exist server-side, so every local reference to it has to move
 * to the winner the server named. A transaction, bill or income stream whose push is *still queued* only
 * needs its queued payload rewritten — enqueueing a second update for a row the server has never seen
 * would push a `merchant_id` the server would reject, then immediately correct it.
 */

export type AdoptionInput = {
  tempId: string
  winnerId: string
  /** Local transactions that point at the temp merchant. */
  transactions: Pick<LocalTransaction, 'id' | 'merchantId'>[]
  /** Local bills that point at the temp merchant. */
  bills: Pick<LocalBill, 'id' | 'merchantId'>[]
  /** Local income streams that point at the temp merchant. */
  streams: Pick<LocalIncomeStream, 'id' | 'merchantId'>[]
  /** The whole outbox as it stands. */
  queued: OutboxEntry[]
  /** The aliases the temp merchant carried. */
  tempAliases: LocalMerchantAlias[]
  /** Every alias known locally, to spot keys that belong to a third merchant. */
  knownAliases: Pick<LocalMerchantAlias, 'merchantId' | 'normalizedKey'>[]
}

export type AdoptionPlan = {
  /** Local transaction rows to repoint at the winner. */
  repointTransactionIds: string[]
  /** Queued payloads whose `merchant_id` becomes the winner's, in place. */
  rewrites: { seq: number; payload: unknown }[]
  /** Already-pushed transactions that need a real `PATCH`. */
  patchTransactionIds: string[]
  repointBillIds: string[]
  /** Already-pushed bills that need a real `PATCH`. */
  patchBillIds: string[]
  repointIncomeIds: string[]
  /** Already-pushed income streams that need a real `PATCH`. */
  patchIncomeIds: string[]
  /** Temp alias rows to repoint at the winner and push onto it. */
  aliasesToFold: LocalMerchantAlias[]
  /** Temp alias rows whose key belongs to a third merchant — dropped, not pushed. */
  aliasesToDiscard: LocalMerchantAlias[]
}

const isPayloadObject = (
  payload: unknown,
): payload is Record<string, unknown> =>
  typeof payload === 'object' && payload !== null

const LINKED_ENTITIES = ['transaction', 'bill', 'income'] as const
type LinkedEntity = (typeof LINKED_ENTITIES)[number]

const isLinked = (entity: string): entity is LinkedEntity =>
  (LINKED_ENTITIES as readonly string[]).includes(entity)

const queueKey = (entity: LinkedEntity, id: string) => `${entity}:${id}`

export function planAdoption(input: AdoptionInput): AdoptionPlan {
  const { tempId, winnerId } = input

  const rewritable = new Map<string, OutboxEntry[]>()
  for (const entry of input.queued) {
    if (!isLinked(entry.entity)) continue
    if (entry.op === 'delete' || !isPayloadObject(entry.payload)) continue
    const key = queueKey(entry.entity, entry.id)
    const list = rewritable.get(key)
    if (list) list.push(entry)
    else rewritable.set(key, [entry])
  }

  const rewrites: AdoptionPlan['rewrites'] = []
  const planLinked = (
    entity: LinkedEntity,
    rows: { id: string; merchantId: string | null }[],
  ) => {
    const repoint: string[] = []
    const patch: string[] = []
    for (const row of rows) {
      if (row.merchantId !== tempId) continue
      repoint.push(row.id)
      const entries = rewritable.get(queueKey(entity, row.id))
      if (!entries) {
        patch.push(row.id)
        continue
      }
      for (const entry of entries) {
        if (entry.seq === undefined) continue
        const payload = entry.payload as Record<string, unknown>
        rewrites.push({
          seq: entry.seq,
          payload: { ...payload, merchant_id: winnerId },
        })
      }
    }
    return { repoint, patch }
  }
  const transactions = planLinked('transaction', input.transactions)
  const bills = planLinked('bill', input.bills)
  const streams = planLinked('income', input.streams)

  const ownedElsewhere = new Set(
    input.knownAliases
      .filter((a) => a.merchantId !== winnerId && a.merchantId !== tempId)
      .map((a) => a.normalizedKey),
  )
  const seen = new Set<string>()
  const aliasesToFold: LocalMerchantAlias[] = []
  const aliasesToDiscard: LocalMerchantAlias[] = []
  for (const alias of input.tempAliases) {
    const key = alias.normalizedKey
    if (!key || seen.has(key) || ownedElsewhere.has(key)) {
      aliasesToDiscard.push(alias)
      continue
    }
    seen.add(key)
    aliasesToFold.push(alias)
  }

  return {
    repointTransactionIds: transactions.repoint,
    rewrites,
    patchTransactionIds: transactions.patch,
    repointBillIds: bills.repoint,
    patchBillIds: bills.patch,
    repointIncomeIds: streams.repoint,
    patchIncomeIds: streams.patch,
    aliasesToFold,
    aliasesToDiscard,
  }
}
