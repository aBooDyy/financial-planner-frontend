import { describe, expect, it } from 'vitest'
import { setAside } from '#/features/planned/testing/fixtures'
import { countsAsGoalSaving } from './goalSaving'

describe('countsAsGoalSaving', () => {
  it('counts a live goal set-aside and one a payment used', () => {
    expect(countsAsGoalSaving(setAside())).toBe(true)
    expect(
      countsAsGoalSaving(
        setAside({ releasedAt: '2026-10-01', releasedById: 'tx1' }),
      ),
    ).toBe(true)
  })

  it('leaves out money freed again, bills and deleted rows', () => {
    expect(countsAsGoalSaving(setAside({ releasedAt: '2026-10-01' }))).toBe(
      false,
    )
    expect(countsAsGoalSaving(setAside({ goalId: null, billId: 'b1' }))).toBe(
      false,
    )
    expect(countsAsGoalSaving(setAside({ deleted: 1 }))).toBe(false)
  })

  it('counts a moved set-aside once, through the row it ended up in', () => {
    const source = setAside({
      releasedAt: '2026-10-05',
      movedByTransferId: 't1',
    })
    const movedIn = setAside({ date: '2026-10-05', movedByTransferId: 't1' })
    // A release clears the move's mark, so a paid or freed moved-in row has none.
    const movedInThenPaid = setAside({
      date: '2026-10-05',
      releasedAt: '2026-10-20',
      releasedById: 'tx9',
    })
    const movedInThenFreed = setAside({
      date: '2026-10-05',
      releasedAt: '2026-10-20',
    })
    expect(countsAsGoalSaving(source)).toBe(false)
    expect(countsAsGoalSaving(movedIn)).toBe(true)
    expect(countsAsGoalSaving(movedInThenPaid)).toBe(true)
    expect(countsAsGoalSaving(movedInThenFreed)).toBe(false)
  })
})
