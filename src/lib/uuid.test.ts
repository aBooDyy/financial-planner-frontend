import { describe, expect, it } from 'vitest'
import { isUuid, newId } from './uuid'

describe('newId', () => {
  it('is a canonical version-7, RFC-variant uuid', () => {
    const id = newId()
    expect(isUuid(id)).toBe(true)
    expect(id[14]).toBe('7')
    expect('89ab').toContain(id[19])
  })

  it('leads with the millisecond timestamp', () => {
    const ms = 0x0192_3456_789a
    expect(newId(ms).replace(/-/g, '').slice(0, 12)).toBe('01923456789a')
  })

  it('sorts ids from later milliseconds after earlier ones', () => {
    const earlier = newId(1_800_000_000_000)
    const later = newId(1_800_000_000_001)
    expect(earlier < later).toBe(true)
  })

  it('differs between ids of the same millisecond', () => {
    expect(newId(1_800_000_000_000)).not.toBe(newId(1_800_000_000_000))
  })
})

describe('isUuid', () => {
  it('accepts the canonical form in either case', () => {
    expect(isUuid('0b6f3c1e-9a2d-4f7b-8c1e-2d3f4a5b6c7d')).toBe(true)
    expect(isUuid('0B6F3C1E-9A2D-4F7B-8C1E-2D3F4A5B6C7D')).toBe(true)
  })

  it('refuses anything that could reshape a path', () => {
    expect(isUuid('../auth/me')).toBe(false)
    expect(isUuid('0b6f3c1e-9a2d-4f7b-8c1e-2d3f4a5b6c7d/../x')).toBe(false)
    expect(isUuid(' 0b6f3c1e-9a2d-4f7b-8c1e-2d3f4a5b6c7d')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(42)).toBe(false)
  })
})
