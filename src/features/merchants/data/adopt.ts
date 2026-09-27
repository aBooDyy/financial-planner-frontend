import type {
  LocalMerchantAlias,
  LocalRecurring,
  LocalTransaction,
  OutboxEntry,
} from '#/db/types'

/**
 * The planning half of adopt-and-remap (`sync.ts` applies it).
 *
 * When `POST /merchants` is refused with `409 merchants.alias.taken`, nothing was written:
 * the temp merchant does not exist server-side, so every local reference to it has to move
 * to the winner the server named. A transaction or schedule whose push is *still queued* only
 * needs its queued payload rewritten — enqueueing a second update for a row the server has never seen
 * would push a `merchant_id` the server would reject, then immediately correct it.
 */

export type AdoptionInput = {
  tempId: string
  winnerId: string
  /** Local transactions that point at the temp merchant. */
  transactions: Pick<LocalTransaction, 'id' | 'merchantId'>[]
  /** Local recurring schedules that point at the temp merchant. */
  recurrings: Pick<LocalRecurring, 'id' | 'merchantId'>[]
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
  repointRecurringIds: string[]
  /** Already-pushed schedules that need a real `PATCH`. */
  patchRecurringIds: string[]
  /** Temp alias rows to repoint at the winner and push onto it. */
  aliasesToFold: LocalMerchantAlias[]
  /** Temp alias rows whose key belongs to a third merchant — dropped, not pushed. */
  aliasesToDiscard: LocalMerchantAlias[]
}

const isPayloadObject = (
  payload: unknown,
): payload is Record<string, unknown> =>
  typeof payload === 'object' && payload !== null

type LinkedEntity = 'transaction' | 'recurring'

const queueKey = (entity: LinkedEntity, id: string) => `${entity}:${id}`

export function planAdoption(input: AdoptionInput): AdoptionPlan {
  const { tempId, winnerId } = input

  const rewritable = new Map<string, OutboxEntry[]>()
  for (const entry of input.queued) {
    if (entry.entity !== 'transaction' && entry.entity !== 'recurring') continue
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
  const recurrings = planLinked('recurring', input.recurrings)

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
    repointRecurringIds: recurrings.repoint,
    patchRecurringIds: recurrings.patch,
    aliasesToFold,
    aliasesToDiscard,
  }
}
