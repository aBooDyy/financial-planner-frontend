import { describe, expect, it } from 'vitest'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { m, planned } from '#/features/planned/testing/fixtures'
import { balanceAhead } from './ahead'

const TODAY = '2026-10-02'

const row = (over: Parameters<typeof planned>[0], setAside = 0): UpcomingRow =>
  ({
    id: over?.id ?? 'r',
    item: planned(over),
    name: over?.name ?? 'Row',
    remainder: over?.amount ?? 0,
    currency: 'SAR',
    coverage:
      over?.role === 'payment'
        ? { state: setAside > 0 ? 'covered' : 'not_set_aside', setAside }
        : null,
  }) as unknown as UpcomingRow

describe('Balance ahead', () => {
  it('releases a payment’s own set-aside, so a saved-for bill never dips free money (F8)', () => {
    const view = balanceAhead({
      rows: [
        row(
          {
            id: 'ins',
            role: 'payment',
            origin: 'bill',
            amount: m(1200),
            occurrence: '2026-10-10',
          },
          m(1200),
        ),
      ],
      balance: m(5000),
      setAside: m(1200),
      base: 'SAR',
      rates: { SAR: 1 },
      today: TODAY,
    })
    expect(view.days[0].free).toBe(m(3800))
    expect(view.days[8]).toMatchObject({
      balance: m(3800),
      setAside: 0,
      free: m(3800),
    })
    expect(view.note).not.toMatch(/below zero/)
  })

  it('takes uncovered bills out of free money and adds paydays back', () => {
    const view = balanceAhead({
      rows: [
        row({
          id: 'rent',
          role: 'payment',
          origin: 'bill',
          amount: m(3000),
          occurrence: '2026-10-20',
        }),
        row({
          id: 'pay',
          role: 'income',
          origin: 'income',
          amount: m(12000),
          occurrence: '2026-10-25',
        }),
        row({
          id: 'goal',
          role: 'set_aside',
          amount: m(1000),
          occurrence: '2026-10-25',
        }),
      ],
      balance: m(4000),
      setAside: 0,
      base: 'SAR',
      rates: { SAR: 1 },
      today: TODAY,
    })
    expect(view.paydays).toEqual([23])
    expect(view.days[18].free).toBe(m(1000))
    expect(view.days[23]).toMatchObject({ balance: m(13000), free: m(12000) })
    expect(view.low).toBe(18)
    expect(view.note).toBe('Free to spend is lowest on Oct 20 at SR 1,000.')
  })
})
