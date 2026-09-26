import { describe, expect, it } from 'vitest'
import { lookbackSince, windowOptions } from './windows'

const TODAY = new Date(2026, 8, 27)

describe('windowOptions', () => {
  it('drops the windows past the server ceiling', () => {
    expect(windowOptions(90)).toEqual([7, 30, 90])
  })
})

describe('lookbackSince', () => {
  it('reads today alone as one day', () => {
    expect(lookbackSince('2026-09-27', TODAY, 180)).toBe(1)
  })

  it('reaches the whole of an earlier date', () => {
    expect(lookbackSince('2026-09-20', TODAY, 180)).toBe(8)
  })

  it('refuses a future date', () => {
    expect(lookbackSince('2026-09-28', TODAY, 180)).toBeNull()
  })

  it('refuses a date past the ceiling, and takes the last one inside it', () => {
    expect(lookbackSince('2026-04-01', TODAY, 180)).toBe(180)
    expect(lookbackSince('2026-03-31', TODAY, 180)).toBeNull()
  })

  it('refuses an empty or unreadable date', () => {
    expect(lookbackSince('', TODAY, 180)).toBeNull()
    expect(lookbackSince('27/09/2026', TODAY, 180)).toBeNull()
  })
})
