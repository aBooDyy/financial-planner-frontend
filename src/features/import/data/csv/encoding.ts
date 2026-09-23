/**
 * Bytes → text. A bank export is whatever its bank felt like emitting, so the encoding is
 * sniffed rather than assumed: a BOM is authoritative, otherwise UTF-8 is tried and only
 * retried when it visibly failed.
 */

export type EncodingDetection = { encoding: string; text: string }

/** Retried in this order when UTF-8 produces replacement characters. */
export const RETRY_ENCODINGS = ['windows-1256', 'windows-1252'] as const

export const DEFAULT_ENCODING = 'utf-8'

/** Above this share of U+FFFD the UTF-8 read is treated as wrong, not merely imperfect. */
const REPLACEMENT_RATIO_LIMIT = 0.001

/** How much of an Arabic-script decoding has to read as words before we believe it. */
const ARABIC_RUN_LIMIT = 0.5

const BOMS: ReadonlyArray<{ bytes: ReadonlyArray<number>; encoding: string }> =
  [
    { bytes: [0xef, 0xbb, 0xbf], encoding: 'utf-8' },
    { bytes: [0xff, 0xfe], encoding: 'utf-16le' },
    { bytes: [0xfe, 0xff], encoding: 'utf-16be' },
  ]

/** U+FFFD, what a decoder emits where the bytes made no sense. */
const REPLACEMENT_CHAR = String.fromCharCode(0xfffd)

const ARABIC_BLOCK = /\p{Script=Arabic}/u

const startsWith = (
  bytes: Uint8Array,
  prefix: ReadonlyArray<number>,
): boolean => prefix.every((byte, i) => bytes[i] === byte)

export const sniffBom = (bytes: Uint8Array): string | null =>
  BOMS.find((bom) => startsWith(bytes, bom.bytes))?.encoding ?? null

const decode = (bytes: Uint8Array, encoding: string): string =>
  new TextDecoder(encoding, { fatal: false }).decode(bytes)

const replacementRatio = (text: string): number => {
  if (text.length === 0) return 0
  let hits = 0
  for (const char of text) if (char === REPLACEMENT_CHAR) hits += 1
  return hits / text.length
}

/**
 * Share of the non-ASCII characters that sit in an Arabic run of two or more. Real Arabic
 * scores near 1; a Latin-1 file misread as windows-1256 scores near 0, because its accented
 * letters land as lone Arabic characters wedged between ASCII ones.
 */
const arabicRunRatio = (text: string): number => {
  let nonAscii = 0
  let inRuns = 0
  let run = 0
  for (const char of text) {
    if (char.charCodeAt(0) > 0x7f) nonAscii += 1
    if (ARABIC_BLOCK.test(char)) {
      run += 1
    } else {
      if (run >= 2) inRuns += run
      run = 0
    }
  }
  if (run >= 2) inRuns += run
  return nonAscii === 0 ? 0 : inRuns / nonAscii
}

/**
 * Decode a CSV's bytes, choosing the encoding unless one is forced (the Adjust dialog).
 * A UTF-8 read that produced almost no replacement characters is kept; otherwise the file
 * is legacy single-byte and the Arabic candidate is preferred only when it reads as Arabic.
 */
export const decodeCsvBytes = (
  bytes: Uint8Array,
  forced?: string,
): EncodingDetection => {
  if (forced) return { encoding: forced, text: decode(bytes, forced) }

  const bom = sniffBom(bytes)
  if (bom) return { encoding: bom, text: decode(bytes, bom) }

  const utf8 = decode(bytes, DEFAULT_ENCODING)
  if (replacementRatio(utf8) <= REPLACEMENT_RATIO_LIMIT) {
    return { encoding: DEFAULT_ENCODING, text: utf8 }
  }

  const arabic = decode(bytes, 'windows-1256')
  if (arabicRunRatio(arabic) >= ARABIC_RUN_LIMIT) {
    return { encoding: 'windows-1256', text: arabic }
  }
  return { encoding: 'windows-1252', text: decode(bytes, 'windows-1252') }
}
