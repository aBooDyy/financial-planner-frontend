import { describe, expect, it } from 'vitest'
import {
  RATES,
  m,
  planned,
  setAside,
  tx,
} from '#/features/planned/testing/fixtures'
import {
  MATCH_WINDOW,
  behindOf,
  dueList,
  findMatch,
  indexSettlements,
  isDue,
  remainderOf,
  settledOf,
} from './settle'

describe('settledOf / remainderOf', () => {
  it('sums the linked transactions and reservations, converted to the item currency', () => {
    const item = planned({ id: 'p1', amount: m(1500), currency: 'SAR' })
    const index = indexSettlements(
      [
        tx({ plannedId: 'p1', amount: m(100), currency: 'USD' }), // 375 SAR
        tx({ plannedId: 'other', amount: m(999) }),
        tx({ plannedId: 'p1', amount: m(50), deleted: 1 }),
      ],
      [setAside({ plannedId: 'p1', amount: m(500), currency: 'SAR' })],
    )
    expect(settledOf(item, index, RATES)).toBe(m(875))
    expect(remainderOf(item, index, RATES)).toBe(m(625))
  })

  it('never goes negative on an overpayment', () => {
    const item = planned({ id: 'p1', amount: m(1500) })
    const index = indexSettlements(
      [tx({ plannedId: 'p1', amount: m(2000) })],
      [],
    )
    expect(settledOf(item, index, RATES)).toBe(m(2000))
    expect(remainderOf(item, index, RATES)).toBe(0)
  })

  it('still counts a released set-aside: the money was set aside, then used', () => {
    const item = planned({ id: 'p1', amount: m(500) })
    const index = indexSettlements(
      [],
      [setAside({ plannedId: 'p1', amount: m(500), releasedAt: '2026-10-01' })],
    )
    expect(settledOf(item, index, RATES)).toBe(m(500))
  })
})

describe('isDue / dueList', () => {
  it('is due when open and dated today or earlier, oldest first', () => {
    const items = [
      planned({ id: 'b', date: '2026-09-24', occurrence: '2026-09-24' }),
      planned({ id: 'a', date: '2026-09-01', occurrence: '2026-09-01' }),
      planned({ id: 'c', date: '2026-09-25', occurrence: '2026-09-25' }),
      planned({ id: 'd', date: '2026-08-01', status: 'done' }),
    ]
    expect(isDue(items[0], '2026-09-24')).toBe(true)
    expect(isDue(items[2], '2026-09-24')).toBe(false)
    expect(dueList(items, '2026-09-24').map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('findMatch', () => {
  const items = [
    planned({ id: 'sep', goalId: 'umrah', occurrence: '2026-09-01' }),
    planned({ id: 'oct', goalId: 'umrah', occurrence: '2026-10-01' }),
    planned({
      id: 'pay',
      goalId: 'umrah',
      role: 'payment',
      occurrence: '2026-09-10',
    }),
    planned({ id: 'other', goalId: 'car', occurrence: '2026-09-05' }),
  ]

  it('picks the oldest open item of the origin and role inside the window', () => {
    expect(
      findMatch({ goalId: 'umrah' }, 'set_aside', '2026-09-24', items)?.id,
    ).toBe('sep')
  })

  it('finds nothing outside the window', () => {
    // 45 days after Oct 1 is Nov 15; the window reaches back only that far.
    expect(
      findMatch({ goalId: 'umrah' }, 'set_aside', '2026-11-16', items),
    ).toBeNull()
    expect(
      findMatch({ goalId: 'umrah' }, 'set_aside', '2026-08-01', items),
    ).toBeNull()
    expect(MATCH_WINDOW).toEqual({ before: 45, after: 15 })
  })

  it('finds nothing for another role, and skips closed items', () => {
    expect(
      findMatch({ goalId: 'car' }, 'payment', '2026-09-05', items),
    ).toBeNull()
    const closed = items.map((p) =>
      p.id === 'sep' ? { ...p, status: 'done' as const } : p,
    )
    expect(
      findMatch({ goalId: 'umrah' }, 'set_aside', '2026-09-24', closed)?.id,
    ).toBe('oct')
  })

  it('matches a payday by its stream', () => {
    const payday = planned({
      id: 'payday',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 'salary',
      occurrence: '2026-09-27',
    })
    expect(
      findMatch({ incomeStreamId: 'salary' }, 'income', '2026-09-28', [payday])
        ?.id,
    ).toBe('payday')
  })
})

describe('behindOf', () => {
  const plan = [
    planned({
      id: 'jul',
      goalId: 'umrah',
      occurrence: '2026-07-01',
      status: 'done',
    }),
    planned({
      id: 'aug',
      goalId: 'umrah',
      occurrence: '2026-08-01',
      status: 'done',
    }),
    planned({ id: 'sep', goalId: 'umrah', occurrence: '2026-09-01' }),
    planned({ id: 'oct', goalId: 'umrah', occurrence: '2026-10-01' }),
  ]
  const confirmed = indexSettlements(
    [],
    [
      setAside({ goalId: 'umrah', plannedId: 'jul', amount: m(1500) }),
      setAside({ goalId: 'umrah', plannedId: 'aug', amount: m(1500) }),
    ],
  )

  it('is what was due by today minus what settled it', () => {
    const b = behindOf('umrah', plan, confirmed, RATES, '2026-09-24')
    expect(b.expected).toBe(m(4500))
    expect(b.settled).toBe(m(3000))
    expect(b.behind).toBe(m(1500))
    expect(b.unconfirmed.map((p) => p.id)).toEqual(['sep'])
  })

  it('still counts a skipped set-aside — skipping is behind on purpose', () => {
    const skipped = plan.map((p) =>
      p.id === 'sep' ? { ...p, status: 'skipped' as const } : p,
    )
    const b = behindOf('umrah', skipped, confirmed, RATES, '2026-09-24')
    expect(b.behind).toBe(m(1500))
    expect(b.skipped.map((p) => p.id)).toEqual(['sep'])
  })

  it('goes negative when more settled than planned — ahead', () => {
    const ahead = indexSettlements(
      [],
      [
        setAside({ plannedId: 'jul', amount: m(1500) }),
        setAside({ plannedId: 'aug', amount: m(1500) }),
        setAside({ plannedId: 'sep', amount: m(2000) }),
      ],
    )
    expect(behindOf('umrah', plan, ahead, RATES, '2026-09-24').behind).toBe(
      -m(500),
    )
  })
})
