import { describe, expect, it } from 'vitest'
import { contributionCopy, laterDefaultDate } from './contribution'
import type { ContributionCopyInput } from './contribution'

const m = (whole: number) => whole * 100

const base: ContributionCopyInput = {
  mode: 'now',
  amount: m(1000),
  currency: 'SAR',
  goalName: 'Umrah trip',
  role: 'set_aside',
  saved: m(4000),
  due: null,
  externalLabel: null,
  date: '2026-09-24',
}

describe('contributionCopy', () => {
  it('paid now: a confirmed set-aside and where saved lands', () => {
    expect(contributionCopy(base)).toEqual({
      hint: 'Adds a confirmed set-aside, tagged Umrah trip. The money stays in the wallet, reserved. Saved goes to SR 5,000.',
      cta: 'Add SR 1,000',
    })
  })

  it('paid now settles a due item instead of adding beside it', () => {
    const { hint } = contributionCopy({
      ...base,
      due: { date: '2026-09-01', remainder: m(1500), currency: 'SAR' },
    })
    expect(hint).toBe(
      'Settles the planned Sep 1 set-aside (SR 1,500) instead of adding a second entry. Saved goes to SR 5,000.',
    )
  })

  it('names an external source', () => {
    expect(
      contributionCopy({ ...base, externalLabel: "Dad's help" }).hint,
    ).toBe(
      "Adds Dad's help as a set-aside for Umrah trip, held outside your wallets. Saved goes to SR 5,000.",
    )
  })

  it('a bill is paid, not saved', () => {
    expect(
      contributionCopy({ ...base, role: 'payment', goalName: 'Rent', saved: 0 })
        .hint,
    ).toBe(
      'Adds a confirmed payment in Spending, tagged Rent. Paid goes to SR 1,000.',
    )
  })

  it('plan for later: a planned item on the date', () => {
    expect(
      contributionCopy({ ...base, mode: 'later', date: '2026-10-15' }),
    ).toEqual({
      hint: 'Adds a planned item on Oct 15. It shows in Spending as planned and only counts once you confirm it.',
      cta: 'Plan SR 1,000',
    })
  })

  it('has a bare label until an amount is typed', () => {
    expect(contributionCopy({ ...base, amount: 0 }).cta).toBe('Add')
    expect(contributionCopy({ ...base, amount: 0, mode: 'later' }).cta).toBe(
      'Plan',
    )
  })
})

describe('laterDefaultDate', () => {
  it('is the next planned date, else a month out', () => {
    const today = new Date(2026, 8, 24)
    expect(laterDefaultDate('2026-10-01', today)).toBe('2026-10-01')
    expect(laterDefaultDate(null, today)).toBe('2026-10-24')
  })
})
