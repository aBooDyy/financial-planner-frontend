import { afterEach, describe, expect, it } from 'vitest'
import { useAppConfigStore } from './appConfig'
import type { CustomCurrencyMeta } from './appConfig'
import { defaultRateFor, isRateOverridden, mergeRates } from './rates'

const PTS: CustomCurrencyMeta = {
  id: 'cc-1',
  code: 'PTS',
  name: 'Airline Points',
  symbol: 'pts',
  minorUnit: 0,
  rate: 0.05,
  custom: true,
}

const withCustom = (...custom: CustomCurrencyMeta[]) =>
  useAppConfigStore.getState().applyCustomCurrencies(custom)

afterEach(() => withCustom())

describe('mergeRates', () => {
  it('serves the shipped defaults when the user has changed nothing', () => {
    const rates = mergeRates([])
    expect(rates.SAR).toBe(defaultRateFor('SAR'))
    expect(rates.USD).toBe(defaultRateFor('USD'))
  })

  it('lets a user override beat the default', () => {
    const rates = mergeRates([{ currency: 'USD', rate: 4 }])
    expect(rates.USD).toBe(4)
    expect(rates.EUR).toBe(defaultRateFor('EUR'))
  })

  it('leaves an unpriced currency without a rate', () => {
    // A few listed currencies deliberately ship no rate; conversion must stay undefined.
    expect(defaultRateFor('SYP')).toBeUndefined()
    expect(mergeRates([]).SYP).toBeUndefined()
    expect(mergeRates([{ currency: 'SYP', rate: 0.0003 }]).SYP).toBe(0.0003)
  })
})

describe('isRateOverridden', () => {
  it('is false for a row that still equals the default', () => {
    const usd = defaultRateFor('USD') as number
    expect(isRateOverridden('USD', usd)).toBe(false)
    expect(isRateOverridden('USD', usd + 0.5)).toBe(true)
  })

  it('treats any row for an unpriced currency as an override', () => {
    expect(isRateOverridden('SYP', 0.0003)).toBe(true)
  })
})

describe('currencies the user defined', () => {
  it('prices itself from the rate on its own row', () => {
    withCustom(PTS)
    expect(mergeRates([]).PTS).toBe(0.05)
    expect(defaultRateFor('PTS')).toBe(0.05)
  })

  it('has no rate at all before it is defined', () => {
    expect(mergeRates([]).PTS).toBeUndefined()
  })

  it('joins the lookup every currency helper reads', () => {
    withCustom(PTS)
    const meta = useAppConfigStore.getState().byCode.get('PTS')
    expect(meta).toMatchObject({ name: 'Airline Points', minorUnit: 0 })
    // It is offered in the pickers too, ahead of the ISO table.
    expect(useAppConfigStore.getState().custom).toHaveLength(1)
  })

  it('never displaces an ISO currency of the same code', () => {
    withCustom({ ...PTS, code: 'USD', name: 'Not the dollar' })
    expect(useAppConfigStore.getState().byCode.get('USD')?.name).toBe(
      'US Dollar',
    )
    expect(mergeRates([]).USD).toBe(defaultRateFor('USD'))
    // It is dropped outright, so it can't reach a picker either.
    expect(useAppConfigStore.getState().custom).toHaveLength(0)
  })
})
