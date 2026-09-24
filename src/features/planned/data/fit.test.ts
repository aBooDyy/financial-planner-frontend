import { describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { m, planned } from '#/features/planned/testing/fixtures'
import { fitGoalPlan } from './fit'
import type { DesiredPlanned } from './generate'

const TODAY = '2026-09-24'

const want = (occurrence: string, amount: number): DesiredPlanned => {
  const { createdAt, updatedAt, version, dirty, deleted, ...rest } = planned({
    id: `umrah:${occurrence}`,
    goalId: 'umrah',
    occurrence,
    amount,
  })
  void [createdAt, updatedAt, version, dirty, deleted]
  return rest
}

const fit = (
  desired: DesiredPlanned[],
  existing: LocalPlanned[],
  settled: (row: LocalPlanned) => number = () => 0,
) =>
  fitGoalPlan({
    goalId: 'umrah',
    desired,
    existing,
    today: TODAY,
    isSettled: (row) => settled(row) > 0,
    remainderOf: (row) => Math.max(0, row.amount - settled(row)),
  })

const PLAN = ['2026-10-01', '2026-11-01', '2026-12-01'].map((d) =>
  want(d, m(3000)),
)

describe('fitGoalPlan', () => {
  it('is the engine’s plan exactly when nothing is in the way', () => {
    const out = fit(PLAN, [])
    expect(out.writable.map((d) => d.amount)).toEqual([
      m(3000),
      m(3000),
      m(3000),
    ])
    expect(out.header).toMatchObject({ amount: m(3000), count: 3 })
  })

  it('spreads a date taken by a confirmed row over the rest, the last taking the rounding', () => {
    const done = planned({
      id: 'umrah:2026-10-01',
      goalId: 'umrah',
      occurrence: '2026-10-01',
      status: 'done',
    })
    const out = fit([...PLAN, want('2027-01-01', m(1000))], [done])
    // 10,000 over Nov / Dec / Jan in proportion to 3,000 / 3,000 / 1,000.
    expect(out.writable.map((d) => [d.occurrence, d.amount])).toEqual([
      ['2026-11-01', 428571],
      ['2026-12-01', 428571],
      ['2027-01-01', 142858],
    ])
    expect(out.writable.reduce((a, d) => a + d.amount, 0)).toBe(m(10000))
    expect(out.header).toMatchObject({ count: 3, start: '2026-11-01' })
    // The blocked row is still handed to the reconciler, which leaves it alone.
    expect(out.rows.map((d) => d.id)).toContain('umrah:2026-10-01')
  })

  it('subtracts what still stands open on rows nobody may rewrite, hand-made ones included', () => {
    const pinned = planned({
      id: 'umrah:2026-10-01',
      goalId: 'umrah',
      occurrence: '2026-10-01',
      date: '2026-10-05',
      pinned: true,
      amount: m(3000),
    })
    const manual = planned({
      id: 'manual',
      origin: 'manual',
      goalId: 'umrah',
      occurrence: '2026-10-15',
      amount: m(1000),
    })
    const out = fit(PLAN, [pinned, manual])
    // 9,000 − 3,000 (pinned Oct) − 1,000 (hand-made) = 5,000 over Nov and Dec.
    expect(out.writable.map((d) => d.amount)).toEqual([m(2500), m(2500)])
  })

  it('writes nothing when rows already standing cover what is left', () => {
    const manual = planned({
      id: 'manual',
      origin: 'manual',
      goalId: 'umrah',
      occurrence: '2026-10-15',
      amount: m(9000),
    })
    const out = fit(PLAN, [manual])
    expect(out.writable).toEqual([])
    expect(out.header.count).toBe(0)
  })
})
