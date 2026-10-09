import { describe, expect, it } from 'vitest'
import { groupByDay, placeLabels } from './overview'
import type { DayEvent } from './overview'

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

describe('groupByDay', () => {
  const at = (key: string, date: string, day: number) =>
    ({ key, date, day }) as DayEvent

  it('gathers same-day events under one dot, in order', () => {
    const groups = groupByDay([
      at('a', '2026-10-18', 9),
      at('b', '2026-10-18', 9),
      at('c', '2026-10-25', 16),
    ])
    expect(groups.map((g) => [g.date, g.events.map((e) => e.key)])).toEqual([
      ['2026-10-18', ['a', 'b']],
      ['2026-10-25', ['c']],
    ])
  })
})
