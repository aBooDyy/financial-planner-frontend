import { describe, expect, it } from 'vitest'
import { fixtureBytes } from './__fixtures__/fixtures'
import { decodeCsvBytes, sniffBom } from './encoding'

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

const withPrefix = (prefix: number[], bytes: Uint8Array): Uint8Array =>
  Uint8Array.from([...prefix, ...bytes])

/** Encode text back to a legacy single-byte page by inverting its decoder. */
const legacyBytes = (text: string, encoding: string): Uint8Array => {
  const decoder = new TextDecoder(encoding)
  const reverse = new Map<string, number>()
  for (let byte = 0; byte < 256; byte += 1) {
    const char = decoder.decode(Uint8Array.from([byte]))
    if (!reverse.has(char)) reverse.set(char, byte)
  }
  return Uint8Array.from(
    [...text].map((char) => {
      const byte = reverse.get(char)
      if (byte === undefined) throw new Error(`unmappable: ${char}`)
      return byte
    }),
  )
}

describe('sniffBom', () => {
  it('recognises the three marks a bank export might carry', () => {
    expect(sniffBom(withPrefix([0xef, 0xbb, 0xbf], utf8('a,b')))).toBe('utf-8')
    expect(sniffBom(withPrefix([0xff, 0xfe], utf8('a')))).toBe('utf-16le')
    expect(sniffBom(withPrefix([0xfe, 0xff], utf8('a')))).toBe('utf-16be')
    expect(sniffBom(utf8('Date,Amount'))).toBeNull()
  })
})

describe('decodeCsvBytes', () => {
  it('keeps plain UTF-8 and drops its byte-order mark', () => {
    const decoded = decodeCsvBytes(
      withPrefix([0xef, 0xbb, 0xbf], utf8('Date,Amount\n2026-06-16,1.00')),
    )
    expect(decoded.encoding).toBe('utf-8')
    expect(decoded.text.startsWith('Date')).toBe(true)
  })

  it('reads a UTF-16LE file from its mark', () => {
    const body = 'Date,Amount\n2026-06-16,1.00'
    const bytes = new Uint8Array(2 + body.length * 2)
    bytes.set([0xff, 0xfe])
    const view = new DataView(bytes.buffer)
    for (let i = 0; i < body.length; i += 1) {
      view.setUint16(2 + i * 2, body.charCodeAt(i), true)
    }
    const decoded = decodeCsvBytes(bytes)
    expect(decoded.encoding).toBe('utf-16le')
    expect(decoded.text).toBe(body)
  })

  it('retries an Arabic export as windows-1256', () => {
    const decoded = decodeCsvBytes(fixtureBytes('alrajhi-ar.csv'))
    expect(decoded.encoding).toBe('windows-1256')
    expect(decoded.text).toContain('التاريخ')
    expect(decoded.text).not.toContain('�')
  })

  it('retries a Western export as windows-1252 rather than Arabic', () => {
    const decoded = decodeCsvBytes(
      legacyBytes(
        'Datum;Verwendungszweck\n16.06.2026;Café Müller, Straße 3\n',
        'windows-1252',
      ),
    )
    expect(decoded.encoding).toBe('windows-1252')
    expect(decoded.text).toContain('Café Müller')
  })

  it('leaves UTF-8 alone when only a stray byte is bad', () => {
    const bytes = Uint8Array.from([
      ...utf8('Date,Description,Amount\n2026-06-16,'.padEnd(2000, 'x')),
      0xff,
      ...utf8(',1.00'),
    ])
    expect(decodeCsvBytes(bytes).encoding).toBe('utf-8')
  })

  it('honours a forced encoding from the Adjust dialog', () => {
    const decoded = decodeCsvBytes(fixtureBytes('alrajhi-ar.csv'), 'utf-8')
    expect(decoded.encoding).toBe('utf-8')
    expect(decoded.text).toContain('�')
  })
})
