import { describe, expect, it } from 'vitest'
import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { bill, income, m, wallet } from '#/features/planned/testing/fixtures'
import { billLines, billsInBudget, paycheckHint } from './scheduleEditor'

const catalog = defaultCatalog()

describe('paycheckHint', () => {
  it('names the pay period a per-paycheck budget measures now', () => {
    const cal = {
      kind: 'paycheck' as const,
      stream: income({ day: 25 }),
      perYear: 12,
    }
    expect(paycheckHint(cal, '2026-10-30')).toBe(
      'Resets every payday · Oct 25 – Nov 24',
    )
  })

  it('says it resets monthly until there is income', () => {
    expect(paycheckHint({ kind: 'month', perYear: 12 }, '2026-10-30')).toBe(
      'Add your income to budget per paycheck — until then this resets monthly.',
    )
  })
})

describe('billsInBudget', () => {
  const rent = bill({
    id: 'rent',
    name: 'Rent',
    amount: m(3_000),
    categoryId: catId('rent', 'housing'),
    walletId: 'main',
  })
  const gym = bill({
    id: 'gym',
    name: 'Gym',
    amount: m(200),
    categoryId: catId('health'),
    walletId: 'card',
  })
  const done = bill({
    id: 'done',
    categoryId: catId('housing'),
    closedAt: '2026-09-01',
  })
  const bills = [rent, gym, done]
  const target = (
    scopeType: 'category' | 'wallet' | 'overall',
    over: Partial<{ categoryId: string; walletId: string }> = {},
  ) => ({ scopeType, categoryId: catId('housing'), walletId: 'main', ...over })

  it('takes the open bills filed anywhere under the budget’s category', () => {
    expect(
      billsInBudget(bills, target('category'), catalog).map((b) => b.id),
    ).toEqual(['rent'])
  })

  it('takes an account’s bills, or every open bill for an overall budget', () => {
    expect(
      billsInBudget(bills, target('wallet', { walletId: 'card' }), catalog).map(
        (b) => b.id,
      ),
    ).toEqual(['gym'])
    expect(
      billsInBudget(bills, target('overall'), catalog).map((b) => b.id),
    ).toEqual(['rent', 'gym'])
  })

  it('words each bill where the budget sits', () => {
    const nodes = [wallet({ id: 'main', name: 'Main' })]
    expect(billLines([rent], target('category'), catalog, nodes)).toEqual([
      'Rent (SR 3,000) is planned as a bill in Housing.',
    ])
    expect(billLines([rent], target('wallet'), catalog, nodes)).toEqual([
      'Rent (SR 3,000) is planned as a bill from Main.',
    ])
    expect(
      billLines([{ ...gym, amount: 0 }], target('overall'), catalog, nodes),
    ).toEqual(['Gym is planned as a bill.'])
  })

  it('lists the first three and counts the rest', () => {
    const many = [1, 2, 3, 4, 5].map((i) =>
      bill({ name: `Bill ${i}`, amount: m(i) }),
    )
    const lines = billLines(many, target('overall'), catalog, [])
    expect(lines).toHaveLength(4)
    expect(lines[3]).toBe('And 2 more bills.')
  })
})
