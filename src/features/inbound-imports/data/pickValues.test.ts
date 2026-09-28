import { describe, expect, it } from 'vitest'
import {
  firstTarget,
  nextTarget,
  readDateValue,
  readPick,
  unreadablePick,
} from './pickValues'

const whole = (value: unknown) => ({ value, text: String(value) })

describe('readPick', () => {
  it('reads an amount from a number or a string, keeping it in major units', () => {
    expect(readPick('amount', whole(152.75), 'SAR')).toEqual({
      amount: '152.75',
    })
    expect(readPick('amount', whole('1,234.50'), 'SAR')).toEqual({
      amount: '1234.50',
    })
  })

  it('brings the currency along when the tapped text carries one', () => {
    expect(readPick('amount', whole('SAR 38.00'), 'USD')).toEqual({
      amount: '38.00',
      currency: 'SAR',
    })
  })

  it('refuses an amount that is not a positive number', () => {
    expect(readPick('amount', whole('pending'), 'SAR')).toBeNull()
  })

  it('reads a currency code in any case, and only a known one', () => {
    expect(readPick('currency', whole('sar'), 'USD')).toEqual({
      currency: 'SAR',
    })
    expect(readPick('currency', whole('ZZZ'), 'USD')).toBeNull()
  })

  it('reads a date off ISO strings, epochs and day-first dates', () => {
    expect(readPick('date', whole('2026-09-23T10:02:00Z'), 'SAR')).toEqual({
      date: '2026-09-23',
    })
    expect(readPick('date', whole(1790157720), 'SAR')).toEqual({
      date: '2026-09-23',
    })
    expect(readPick('date', whole('23/09/2026'), 'SAR')).toEqual({
      date: '2026-09-23',
    })
  })

  it('takes a merchant or a note as the tapped text', () => {
    expect(
      readPick(
        'merchant',
        { value: 'x', text: ' CARREFOUR HYPER 4471 ' },
        'SAR',
      ),
    ).toEqual({ merchant: 'CARREFOUR HYPER 4471' })
    expect(readPick('note', whole(''), 'SAR')).toBeNull()
  })
})

describe('readDateValue', () => {
  it('reads month-first only when day-first is impossible', () => {
    expect(readDateValue('09/23/2026')).toBe('2026-09-23')
    expect(readDateValue('03/04/26')).toBe('2026-04-03')
  })

  it('reads epoch milliseconds and rejects nonsense', () => {
    expect(readDateValue(1790157720000)).toBe('2026-09-23')
    expect(readDateValue('31/02/2026')).toBeNull()
    expect(readDateValue(42)).toBeNull()
  })
})

describe('targets', () => {
  it('hops amount → currency → date, skipping currency when the amount brought one', () => {
    expect(nextTarget('amount', { amount: '1' })).toBe('currency')
    expect(nextTarget('amount', { amount: '1', currency: 'SAR' })).toBe('date')
    expect(nextTarget('currency', { currency: 'SAR' })).toBe('date')
    expect(nextTarget('merchant', { merchant: 'x' })).toBe('merchant')
  })

  it('starts on what is missing', () => {
    expect(firstTarget('', true)).toBe('amount')
    expect(firstTarget('10', false)).toBe('currency')
    expect(firstTarget('10', true)).toBe('merchant')
  })

  it('says why a tap filled nothing', () => {
    expect(unreadablePick('amount', 'pending')).toBe(
      '“pending” doesn’t read as an amount.',
    )
  })
})
