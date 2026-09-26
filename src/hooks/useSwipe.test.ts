import { describe, expect, it } from 'vitest'
import { swipeStep } from './useSwipe'

describe('swipeStep', () => {
  it('steps forward on a leftward drag and back on a rightward one', () => {
    expect(swipeStep(-80, 5, false)).toBe(1)
    expect(swipeStep(80, 5, false)).toBe(-1)
  })

  it('mirrors in RTL', () => {
    expect(swipeStep(80, 5, true)).toBe(1)
    expect(swipeStep(-80, 5, true)).toBe(-1)
  })

  it('ignores a tap, a short drag and a scroll', () => {
    expect(swipeStep(0, 0, false)).toBeNull()
    expect(swipeStep(-30, 0, false)).toBeNull()
    expect(swipeStep(-60, 70, false)).toBeNull()
  })
})
