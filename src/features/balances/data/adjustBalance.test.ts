import { describe, expect, it } from 'vitest'
import {
  adjustDoneSummary,
  adjustSubmitLabel,
  adjustmentFor,
  differenceLabel,
  previewAdjustment,
} from './adjustBalance'
import type { TransferWallet } from './transferDialog'

const main: TransferWallet = {
  id: 'main',
  name: 'Main Checking',
  color: '#1F9D6B',
  icon: 'wallet',
  currency: 'SAR',
  balance: 100_000,
}

describe('adjustmentFor', () => {
  it('records a shortfall as money taken from the wallet', () => {
    expect(adjustmentFor(100_000, 88_000)).toEqual({
      type: 'adjustment_out',
      amount: 12_000,
    })
  })

  it('records a surplus as money added to the wallet', () => {
    expect(adjustmentFor(100_000, 100_550)).toEqual({
      type: 'adjustment_in',
      amount: 550,
    })
  })

  it('crosses zero in one entry', () => {
    expect(adjustmentFor(5_000, -2_000)).toEqual({
      type: 'adjustment_out',
      amount: 7_000,
    })
  })

  it('records nothing when the balance already matches', () => {
    expect(adjustmentFor(100_000, 100_000)).toBeNull()
  })
})

describe('previewAdjustment', () => {
  it('holds the current balance until a target is typed', () => {
    const preview = previewAdjustment(main, null)
    expect(preview).toMatchObject({
      hasTarget: false,
      current: 100_000,
      next: 100_000,
      difference: 0,
      adjustment: null,
      canSubmit: false,
    })
    expect(adjustSubmitLabel(preview)).toBe('Enter the actual balance')
  })

  it('previews the new balance and the signed difference', () => {
    const preview = previewAdjustment(main, 120_000)
    expect(preview).toMatchObject({
      hasTarget: true,
      next: 120_000,
      difference: 20_000,
      adjustment: { type: 'adjustment_in', amount: 20_000 },
      canSubmit: true,
    })
    expect(adjustSubmitLabel(preview)).toBe('Adjust balance')
  })

  it('refuses a target equal to the current balance', () => {
    const preview = previewAdjustment(main, 100_000)
    expect(preview.canSubmit).toBe(false)
    expect(adjustSubmitLabel(preview)).toBe('Already matches')
  })
})

describe('labels', () => {
  it('signs the difference and names no change', () => {
    expect(differenceLabel(20_000, 'SAR')).toBe('+SR 200.00')
    expect(differenceLabel(-4_050, 'SAR')).toBe('−SR 40.50')
    expect(differenceLabel(0, 'SAR')).toBe('No change')
  })

  it('sums up what was recorded', () => {
    expect(
      adjustDoneSummary(
        main,
        { type: 'adjustment_out', amount: 12_000 },
        88_000,
      ),
    ).toEqual({
      title: 'Main Checking is now SR 880.00',
      sub: 'Recorded a −SR 120.00 balance adjustment',
    })
  })
})
