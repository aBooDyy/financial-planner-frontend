import { describe, expect, it } from 'vitest'
import { RATES, m, tx, wallet } from '#/features/planned/testing/fixtures'
import {
  CAFES,
  GROCERIES,
  SALARY,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import type { Scope } from '#/features/transactions/data/selectors'
import { reportRange } from './range'
import { buildReport } from './report'

const TODAY = new Date(2026, 8, 29)

const nodes = [
  wallet({ id: 'w1', name: 'Checking', amount: m(10_000) }),
  wallet({ id: 'w2', name: 'Savings', amount: 0 }),
  wallet({
    id: 'w3',
    name: 'Old card',
    amount: m(999),
    archivedAt: '2026-01-01',
  }),
]

const ledger = {
  key: '',
  rows: [
    tx({
      type: 'income',
      walletId: 'w1',
      categoryId: SALARY,
      amount: m(5000),
      date: '2026-09-01',
    }),
    tx({
      type: 'spend',
      walletId: 'w1',
      categoryId: CAFES,
      amount: m(1000),
      merchantId: 'mer1',
      date: '2026-09-10',
    }),
    tx({
      type: 'transfer_out',
      walletId: 'w1',
      categoryId: null,
      amount: m(2000),
      transferId: 'x',
      date: '2026-09-15',
    }),
    tx({
      type: 'transfer_in',
      walletId: 'w2',
      categoryId: null,
      amount: m(2000),
      transferId: 'x',
      date: '2026-09-15',
    }),
    tx({
      type: 'spend',
      walletId: 'w2',
      categoryId: GROCERIES,
      amount: m(300),
      date: '2026-09-20',
    }),
    tx({
      type: 'income',
      walletId: 'w1',
      categoryId: SALARY,
      amount: m(5000),
      date: '2026-08-01',
    }),
    tx({
      type: 'spend',
      walletId: 'w1',
      categoryId: GROCERIES,
      amount: m(500),
      date: '2026-08-05',
    }),
  ],
  before: { w1: m(1000) },
  merchantNames: new Map([['mer1', 'Blue Bottle']]),
}

const report = (scope: Scope) =>
  buildReport({
    ledger,
    nodes,
    scope,
    range: reportRange('this_month', { start: '', end: '' }, 'prev', TODAY),
    today: TODAY,
    catalog: reportCatalog(),
    base: 'SAR',
    rates: RATES,
  })

describe('buildReport', () => {
  it('totals every account without counting the transfer between them', () => {
    const r = report({ type: 'all' })
    expect(r.summary.income.amountStr).toBe('SR 5,000')
    expect(r.summary.spending.amountStr).toBe('SR 1,300')
    expect(r.summary.spending.delta).toEqual({ text: '▲ 160%', tone: 'bad' })
    expect(r.summary.net.amountStr).toBe('+SR 3,700')
    expect(r.summary.vs).toBe('vs Aug 1 – 29, 2026')
    expect(r.trend.whole.spendingStr).toBe('SR 1,300')
  })

  it('reads the balance of the live wallets, the change equal to net', () => {
    const { balance, trend } = report({ type: 'all' })
    expect(balance.startStr).toBe('SR 11,000')
    expect(balance.endStr).toBe('SR 14,700')
    expect(balance.changeStr).toBe('+SR 3,700')
    expect(balance.note).toBe('Equals net for the period')
    expect(trend.columns.at(-1)?.readout?.balance?.endStr).toBe('SR 14,700')
  })

  it('breaks spending and income down, and lists the largest spends', () => {
    const r = report({ type: 'all' })
    expect(r.breakdown.spend.items.map((i) => [i.name, i.amountStr])).toEqual([
      ['Dining', 'SR 1,000'],
      ['Groceries', 'SR 300'],
    ])
    expect(r.breakdown.income.items.map((i) => i.name)).toEqual(['Salary'])
    expect(r.largest.map((i) => [i.title, i.amountStr])).toEqual([
      ['Blue Bottle', 'SR 1,000'],
      ['Groceries', 'SR 300'],
    ])
  })

  it('narrows to one wallet, its transfer out moving the balance only', () => {
    const r = report({ type: 'wallet', id: 'w1' })
    expect(r.summary.income.amountStr).toBe('SR 5,000')
    expect(r.summary.spending.amountStr).toBe('SR 1,000')
    expect(r.summary.net.amountStr).toBe('+SR 4,000')
    expect(r.balance.startStr).toBe('SR 11,000')
    expect(r.balance.endStr).toBe('SR 13,000')
    expect(r.balance.changeStr).toBe('+SR 2,000')
    expect(r.balance.note).toBe('Includes transfers in and out')
    expect(r.largest.map((i) => i.title)).toEqual(['Blue Bottle'])
  })

  it('reads the receiving wallet with its transfer in as balance, not income', () => {
    const r = report({ type: 'wallet', id: 'w2' })
    expect(r.summary.income.amountStr).toBe('SR 0')
    expect(r.summary.spending.amountStr).toBe('SR 300')
    expect(r.balance.startStr).toBe('SR 0')
    expect(r.balance.endStr).toBe('SR 1,700')
    expect(r.breakdown.income.items).toEqual([])
  })
})
