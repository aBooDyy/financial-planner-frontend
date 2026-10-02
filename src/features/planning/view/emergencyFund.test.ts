import { describe, expect, it } from 'vitest'
import { bill, goal } from '#/features/planned/testing/fixtures'
import { emergencyFundPreset, monthlyMustPay } from './emergencyFund'

const RATES = { SAR: 1 }

describe('emergency fund suggestion', () => {
  it('holds three months of must-pay bills that repeat', () => {
    const bills = [
      bill({ id: 'rent', amount: 300000, frequency: 'monthly' }),
      bill({ id: 'ins', amount: 240000, frequency: 'annual' }),
      bill({ id: 'gym', amount: 20000, frequency: 'monthly', mustPay: false }),
      bill({ id: 'once', amount: 50000, frequency: null }),
    ]
    expect(monthlyMustPay(bills, 'SAR', RATES)).toBe(320000)
    expect(emergencyFundPreset([], bills, 'SAR', RATES)).toEqual({
      name: 'Emergency fund',
      target: 960000,
      amount: null,
      mustHave: true,
    })
  })

  it('has no target before there are bills, and is not offered beside a goal', () => {
    expect(emergencyFundPreset([], [], 'SAR', RATES)?.target).toBeNull()
    expect(
      emergencyFundPreset([goal({ id: 'g' })], [], 'SAR', RATES),
    ).toBeNull()
  })
})
