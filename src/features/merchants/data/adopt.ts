import type {
  LocalMerchantAlias,
  LocalTransaction,
  OutboxEntry,
} from '#/db/types'

/**
 * The planning half of adopt-and-remap (`sync.ts` applies it).
 *
 * When `POST /merchants` is refused with `409 merchants.alias.taken`, nothing was written:
 * the temp merchant does not exist server-side, so every local reference to it has to move
 * to the winner the server named. A transaction whose push is *still queued* only needs its
 * queued payload rewritten — enqueueing a second update for a row the server has never seen
 * would push a `merchant_id` the server would reject, then immediately correct it.
 */

export type AdoptionInput = {
  tempId: string
  winnerId: string
  /** Local transactions that point at the temp merchant. */
  transactions: Pick<LocalTransaction, 'id' | 'merchantId'>[]
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
  /** Queued transaction payloads whose `merchant_id` becomes the winner's, in place. */
  rewrites: { seq: number; payload: unknown }[]
  /** Already-pushed transactions that need a real `PATCH`. */
  patchTransactionIds: string[]
  /** Temp alias rows to repoint at the winner and push onto it. */
  aliasesToFold: LocalMerchantAlias[]
  /** Temp alias rows whose key belongs to a third merchant — dropped, not pushed. */
  aliasesToDiscard: LocalMerchantAlias[]
}

const isPayloadObject = (
  payload: unknown,
): payload is Record<string, unknown> =>
  typeof payload === 'object' && payload !== null

export function planAdoption(input: AdoptionInput): AdoptionPlan {
  const { tempId, winnerId } = input

  const rewritable = new Map<string, OutboxEntry[]>()
  for (const entry of input.queued) {
    if (entry.entity !== 'transaction' || entry.op === 'delete') continue
    if (!isPayloadObject(entry.payload)) continue
    const list = rewritable.get(entry.id)
    if (list) list.push(entry)
    else rewritable.set(entry.id, [entry])
  }

  const repointTransactionIds: string[] = []
  const rewrites: AdoptionPlan['rewrites'] = []
  const patchTransactionIds: string[] = []

  for (const tx of input.transactions) {
    if (tx.merchantId !== tempId) continue
    repointTransactionIds.push(tx.id)
    const entries = rewritable.get(tx.id)
    if (entries) {
      for (const entry of entries) {
        if (entry.seq === undefined) continue
        const payload = entry.payload as Record<string, unknown>
        rewrites.push({
          seq: entry.seq,
          payload: { ...payload, merchant_id: winnerId },
        })
      }
    } else {
      patchTransactionIds.push(tx.id)
    }
  }

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
    repointTransactionIds,
    rewrites,
    patchTransactionIds,
    aliasesToFold,
    aliasesToDiscard,
  }
}
