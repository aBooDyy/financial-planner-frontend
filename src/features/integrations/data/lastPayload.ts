import { db } from '#/db/db'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { integrationDeliveriesApi } from '#/features/integrations/api/integrationDeliveriesApi'
import { readSample } from './payloadTree'

/** One place a key's most recent payload might be found; null when it has none. */
type PayloadSource = (keyId: string) => Promise<string | null>

/** The payload a staged import was made from, as its stored body. */
export async function importPayload(importId: string): Promise<string | null> {
  const detail = await inboundImportsApi.getImport(importId)
  return detail.bodyLines.length > 0 ? detail.bodyLines.join('\n') : null
}

/** A JSON object can only parse whole; a text message may have been cut, so it must not be. */
const readsAsPayload = (text: string, cut = false): boolean => {
  const reading = readSample(text, Number.POSITIVE_INFINITY)
  return reading.ok && (reading.kind === 'json' || !cut)
}

/**
 * The whole payload a delivery carried, as a rule can be built from it: its excerpt when that
 * is the whole of it, else the body of the import it staged (kept in full). Null when neither
 * reads as a JSON object or a text message — a refused body, or a request whose secret did
 * not verify.
 */
export async function deliveryPayload(
  delivery: Delivery,
): Promise<string | null> {
  const excerpt = delivery.payloadExcerpt
  if (excerpt && readsAsPayload(excerpt, delivery.payloadTruncated))
    return excerpt
  if (delivery.importId && (excerpt === null || delivery.payloadTruncated)) {
    const body = await importPayload(delivery.importId)
    return body && readsAsPayload(body) ? body : null
  }
  return null
}

/** The newest delivery this key received whose payload a rule could read. */
const newestDeliveryPayload: PayloadSource = async (keyId) => {
  for (const delivery of await integrationDeliveriesApi.list(keyId)) {
    // An import that can no longer be read only rules out this delivery, not older ones.
    const payload = await deliveryPayload(delivery).catch(() => null)
    if (payload) return payload
  }
  return null
}

/** The body of the newest import this key staged. */
const newestImportPayload: PayloadSource = async (keyId) => {
  const rows = await db.inboundImports
    .where('keyId')
    .equals(keyId)
    .filter((row) => row.hasBody)
    .toArray()
  const newest = rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .at(0)
  return newest ? importPayload(newest.id) : null
}

/**
 * Where "Use last payload" looks, best first. The delivery log records every request, not only
 * the ones that staged something; the staged imports are the fallback when it has nothing.
 */
const PAYLOAD_SOURCES: PayloadSource[] = [
  newestDeliveryPayload,
  newestImportPayload,
]

export async function lastPayload(keyId: string): Promise<string | null> {
  for (const source of PAYLOAD_SOURCES) {
    const found = await source(keyId)
    if (found) return found
  }
  return null
}
