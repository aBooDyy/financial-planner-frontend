import { describe, expect, it } from 'vitest'
import { isUuid } from './uuid'

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
