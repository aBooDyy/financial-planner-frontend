const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for the canonical 8-4-4-4-12 hex form every server id takes. */
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

const TIMESTAMP_BYTES = 6

/**
 * A new UUIDv7 (RFC 9562): a 48-bit millisecond timestamp followed by random bits, so
 * ids created later sort later and keep primary-key index inserts append-mostly.
 */
export function newId(now: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  for (let i = 0; i < TIMESTAMP_BYTES; i++)
    bytes[i] = Math.floor(now / 2 ** (8 * (TIMESTAMP_BYTES - 1 - i))) % 256
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
