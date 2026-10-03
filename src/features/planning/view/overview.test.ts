import { describe, expect, it } from 'vitest'
import { placeLabels } from './overview'

describe('placeLabels', () => {
  it('alternates sides while labels have room', () => {
    expect(placeLabels([0, 50, 200, 300], 104)).toEqual([
      { side: 'above', labelled: true },
      { side: 'below', labelled: true },
      { side: 'above', labelled: true },
      { side: 'below', labelled: true },
    ])
  })

  it('moves a crowded label to the other side when that side has room', () => {
    const placed = placeLabels([0, 100, 102, 150], 104)
    expect(placed[2].labelled).toBe(false)
    expect(placed[3]).toEqual({ side: 'above', labelled: true })
  })

  it('hides a label when both sides are crowded', () => {
    expect(placeLabels([0, 50, 100], 104)[2].labelled).toBe(false)
  })
})
