import type { PlannedOrigin, PlannedRole } from '#/features/planned/api/types'
import { toWireOrigin, toWireRole } from '#/features/planned/api/types'

/**
 * Generated planned rows get a deterministic id, so two devices that generate the same
 * occurrence offline produce the same primary key and the server's uniqueness does the
 * de-duplication. RFC 4122 UUIDv5 (SHA-1). Synchronous — Web Crypto's digest is async only,
 * and the generator that calls this is a pure function.
 */

/** Fixed for the app's lifetime: changing it would re-key every generated row. */
export const PLANNED_NAMESPACE = '4f0c7a52-2d5e-4b8e-9a6f-7c1d3e2b9a10'

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n))

export function sha1(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32))
  view.setUint32(padded.length - 4, bitLength >>> 0)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const w = new Uint32Array(80)

  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4)
    for (let i = 16; i < 80; i++)
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0
      e = d
      d = c
      c = rotl(b, 30) >>> 0
      b = a
      a = t
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const out = new Uint8Array(20)
  const outView = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h))
  return out
}

const uuidBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

export function uuidv5(name: string, namespace: string): string {
  const ns = uuidBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const input = new Uint8Array(ns.length + nameBytes.length)
  input.set(ns)
  input.set(nameBytes, ns.length)
  const hash = sha1(input).slice(0, 16)
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = toHex(hash)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** The id of one generated occurrence: `user:ORIGIN:originId:ROLE:occurrence`. */
export const plannedIdFor = (
  userId: string,
  origin: PlannedOrigin,
  originId: string,
  role: PlannedRole,
  occurrence: string,
): string =>
  uuidv5(
    `${userId}:${toWireOrigin(origin)}:${originId}:${toWireRole(role)}:${occurrence}`,
    PLANNED_NAMESPACE,
  )
