import { describe, expect, it } from 'vitest'
import { toNode, toRate, toSettings } from './types'
import type {
  BalanceNodeWire,
  BalanceSettingsWire,
  ExchangeRateWire,
} from './types'

const aNodeWire = (currency: string | null): BalanceNodeWire => ({
  id: 'n1',
  kind: 'WALLET',
  parent_id: null,
  name: 'Main',
  color: '#1F9D6B',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archived_at: null,
  amount: 125000,
  currency,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v1',
})

const aSettingsWire = (base: string): BalanceSettingsWire => ({
  base_currency: base,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v1',
})

const aRateWire = (currency: string): ExchangeRateWire => ({
  id: 'r1',
  currency,
  rate: '3.75',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v1',
})

describe('balances mappers', () => {
  it('accepts any ISO code the config lists', () => {
    expect(toNode(aNodeWire('JPY')).currency).toBe('JPY')
    expect(toNode(aNodeWire(null)).currency).toBeNull()
    expect(toSettings(aSettingsWire('KWD')).baseCurrency).toBe('KWD')
    expect(toRate(aRateWire('USD')).rate).toBe(3.75)
  })

  // The type is `string` now, so the wire is where an unknown code has to be stopped.
  it('rejects an unknown currency code', () => {
    expect(() => toNode(aNodeWire('XXX'))).toThrow(/XXX/)
    expect(() => toSettings(aSettingsWire('nope'))).toThrow()
    expect(() => toRate(aRateWire('XYZ'))).toThrow()
  })
})
