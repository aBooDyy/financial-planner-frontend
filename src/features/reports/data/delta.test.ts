import { describe, expect, it } from 'vitest'
import {
  NO_BASE,
  amountDelta,
  balanceMoney,
  pctDelta,
  signedMoney,
} from './delta'

describe('pctDelta', () => {
  it('has no percentage when the comparison had nothing', () => {
    expect(pctDelta(500, 0, true)).toEqual(NO_BASE)
    expect(pctDelta(0, 0, false)).toEqual(NO_BASE)
  })

  it('reads under one percent either way as no change', () => {
    expect(pctDelta(1005, 1000, true)).toEqual({
      text: 'No change',
      tone: 'neutral',
    })
    expect(pctDelta(995, 1000, false)).toEqual({
      text: 'No change',
      tone: 'neutral',
    })
    expect(pctDelta(1010, 1000, true).text).toBe('▲ 1%')
  })

  it('welcomes more income and less spending', () => {
    expect(pctDelta(1120, 1000, true)).toEqual({ text: '▲ 12%', tone: 'good' })
    expect(pctDelta(880, 1000, true)).toEqual({ text: '▼ 12%', tone: 'bad' })
    expect(pctDelta(1120, 1000, false)).toEqual({ text: '▲ 12%', tone: 'bad' })
    expect(pctDelta(880, 1000, false)).toEqual({ text: '▼ 12%', tone: 'good' })
  })

  it('rounds the percentage and reads a drop to zero as 100%', () => {
    expect(pctDelta(1125, 1000, true).text).toBe('▲ 13%')
    expect(pctDelta(0, 1000, false)).toEqual({ text: '▼ 100%', tone: 'good' })
  })
})

describe('amountDelta', () => {
  it('shows the money difference, good when it rose', () => {
    expect(amountDelta(250_000, 130_000, 'SAR')).toEqual({
      text: '▲ SR 1,200',
      tone: 'good',
    })
    expect(amountDelta(-10_000, 20_000, 'SAR')).toEqual({
      text: '▼ SR 300',
      tone: 'bad',
    })
    expect(amountDelta(5_000, 0, 'USD').text).toBe('▲ $50')
    expect(amountDelta(7_000, 7_000, 'SAR')).toEqual({
      text: 'No change',
      tone: 'neutral',
    })
  })
})

describe('signedMoney', () => {
  it('always signs, with a true minus sign', () => {
    expect(signedMoney(120_000, 'SAR')).toBe('+SR 1,200')
    expect(signedMoney(-30_000, 'SAR')).toBe('−SR 300')
    expect(signedMoney(0, 'SAR')).toBe('+SR 0')
  })
})

describe('balanceMoney', () => {
  it('signs only a negative balance', () => {
    expect(balanceMoney(120_000, 'SAR')).toBe('SR 1,200')
    expect(balanceMoney(-30_000, 'SAR')).toBe('−SR 300')
    expect(balanceMoney(0, 'SAR')).toBe('SR 0')
  })
})
