import { describe, expect, it } from 'vitest'
import { PLANNED_NAMESPACE, plannedIdFor, sha1, uuidv5 } from './ids'

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const utf8 = (s: string) => new TextEncoder().encode(s)

// Reference values from CPython's hashlib / uuid modules.
describe('sha1', () => {
  it('matches the reference digests, across block boundaries', () => {
    expect(hex(sha1(utf8('')))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(hex(sha1(utf8('abc')))).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    )
    expect(hex(sha1(utf8('a'.repeat(1000))))).toBe(
      '291e9a6c66994949b57ba5e650361e98fc36b1ba',
    )
  })
})

describe('uuidv5', () => {
  it('matches RFC 4122 v5 for the standard namespaces', () => {
    expect(uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    )
    expect(
      uuidv5('https://example.com/a', '6ba7b811-9dad-11d1-80b4-00c04fd430c8'),
    ).toBe('6639460f-3425-5329-8097-a58f06127860')
  })

  it('hashes the name as UTF-8', () => {
    expect(uuidv5('ünï😀', PLANNED_NAMESPACE)).toBe(
      'b5a48bcd-75e6-523a-8d99-e9ce9f7d6df5',
    )
  })
})

describe('plannedIdFor', () => {
  it('is the v5 of user:ORIGIN:originId:ROLE:occurrence', () => {
    expect(plannedIdFor('u1', 'goal', 'g1', 'set_aside', '2026-10-01')).toBe(
      'd1916284-68d2-59d6-9bae-01323d5ab91e',
    )
  })

  it('is stable for the same occurrence and differs per user and per occurrence', () => {
    const a = plannedIdFor('u1', 'income', 's1', 'income', '2026-10-01')
    expect(plannedIdFor('u1', 'income', 's1', 'income', '2026-10-01')).toBe(a)
    expect(plannedIdFor('u2', 'income', 's1', 'income', '2026-10-01')).not.toBe(
      a,
    )
    expect(plannedIdFor('u1', 'income', 's1', 'income', '2026-11-01')).not.toBe(
      a,
    )
  })
})
