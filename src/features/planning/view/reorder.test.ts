import { describe, expect, it } from 'vitest'
import { moveInTiers, stepTarget } from './reorder'

const tiers = {
  must: [
    { id: 'rent', position: 0 },
    { id: 'phone', position: 1 },
    { id: 'gym', position: 2 },
  ],
  nice: [{ id: 'stream', position: 0 }],
}

describe('reordering bills and goals', () => {
  it('moves a row up within its tier', () => {
    expect(moveInTiers(tiers, 'gym', 'must', 'rent')).toEqual([
      { id: 'gym', position: 0, tier: 'must' },
      { id: 'rent', position: 1, tier: 'must' },
      { id: 'phone', position: 2, tier: 'must' },
    ])
  })

  it('moves a row into the other tier when dropped on one of its rows', () => {
    expect(moveInTiers(tiers, 'phone', 'nice', 'stream')).toEqual([
      { id: 'gym', position: 1, tier: 'must' },
      { id: 'phone', position: 0, tier: 'nice' },
      { id: 'stream', position: 1, tier: 'nice' },
    ])
  })

  it('drops last when there is no row to drop before', () => {
    expect(moveInTiers(tiers, 'rent', 'must', null)).toEqual([
      { id: 'phone', position: 0, tier: 'must' },
      { id: 'gym', position: 1, tier: 'must' },
      { id: 'rent', position: 2, tier: 'must' },
    ])
  })

  it('steps with the keyboard, stopping at the ends', () => {
    expect(stepTarget(tiers.must, 'phone', -1)).toEqual({ beforeId: 'rent' })
    expect(stepTarget(tiers.must, 'rent', 1)).toEqual({ beforeId: 'gym' })
    expect(stepTarget(tiers.must, 'phone', 1)).toEqual({ beforeId: null })
    expect(stepTarget(tiers.must, 'rent', -1)).toBeNull()
    expect(stepTarget(tiers.must, 'gym', 1)).toBeNull()
  })
})
