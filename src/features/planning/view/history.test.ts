import { describe, expect, it } from 'vitest'
import { autoSettlementId } from '#/features/planned/data/autoConfirm'
import { m, setAside, tx } from '#/features/planned/testing/fixtures'
import { historyOf } from './history'

const base = {
  currency: 'SAR',
  setAsides: [],
  planned: [],
  walletName: () => 'Main bank',
  categoryName: () => 'Visa fees',
  rates: {},
}

describe('historyOf', () => {
  it('marks a payment auto-pay made', () => {
    const lines = historyOf({
      ...base,
      kind: 'bill',
      id: 'b',
      txns: [
        tx({ id: autoSettlementId('p1'), billId: 'b', plannedId: 'p1' }),
        tx({ id: 'manual', billId: 'b', plannedId: 'p2', date: '2026-08-01' }),
      ],
    })
    expect(lines.map((l) => [l.label, l.sub])).toEqual([
      ['Paid · auto-pay', 'Main bank'],
      ['Paid', 'Main bank'],
    ])
  })

  it('names what a goal’s money was used for and where from', () => {
    const [line] = historyOf({
      ...base,
      kind: 'goal',
      id: 'g',
      txns: [tx({ goalId: 'g', amount: m(400) })],
    })
    expect(line).toMatchObject({
      label: 'Used',
      sub: 'Visa fees · Main bank',
      amount: '−SR 400',
    })
  })

  it('shows a freed set-aside as taken back', () => {
    const lines = historyOf({
      ...base,
      kind: 'goal',
      id: 'g',
      txns: [],
      setAsides: [
        setAside({ goalId: 'g', releasedAt: '2026-09-10T00:00:00Z' }),
      ],
    })
    expect(lines.map((l) => l.label)).toEqual(['Taken back', 'Set aside'])
  })
})
