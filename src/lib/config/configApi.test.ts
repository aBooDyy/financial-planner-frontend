import { describe, expect, it } from 'vitest'
import { BUNDLED_CONFIG } from './bundledConfig'
import { toAppConfig } from './configApi'
import type { ConfigWire } from './configApi'

const wire = (limits: Partial<ConfigWire['limits']> = {}): ConfigWire => ({
  version: 'test',
  currencies: [
    { code: 'SAR', name: 'Saudi riyal', symbol: 'SR', minor_unit: 2 },
  ],
  default_rates: { SAR: '3.75' },
  default_base_currency: 'SAR',
  limits: {
    import_max_rows: 1,
    import_max_bytes: 1,
    email_sync_max_lookback_days: 1,
    email_sync_max_limit: 1,
    transaction_bulk_max: 1,
    integration_keys_max: 1,
    integration_rules_max: 1,
    integration_payload_max_bytes: 1,
    ...limits,
  },
})

describe('toAppConfig — planning limits', () => {
  it('mirrors the backend constants in the bundled snapshot', () => {
    expect(BUNDLED_CONFIG.limits.setAsideBatchMax).toBe(200)
    expect(BUNDLED_CONFIG.limits.safeHorizonDaysMin).toBe(7)
    expect(BUNDLED_CONFIG.limits.safeHorizonDaysMax).toBe(90)
  })

  it('falls back to the bundled values when the server does not publish them', () => {
    const { limits } = toAppConfig(wire())
    expect(limits.setAsideBatchMax).toBe(BUNDLED_CONFIG.limits.setAsideBatchMax)
    expect(limits.safeHorizonDaysMin).toBe(
      BUNDLED_CONFIG.limits.safeHorizonDaysMin,
    )
    expect(limits.safeHorizonDaysMax).toBe(
      BUNDLED_CONFIG.limits.safeHorizonDaysMax,
    )
  })

  it('reads the published values', () => {
    const { limits } = toAppConfig(
      wire({
        set_aside_batch_max: 50,
        safe_horizon_days_min: 3,
        safe_horizon_days_max: 60,
      }),
    )
    expect(limits).toMatchObject({
      setAsideBatchMax: 50,
      safeHorizonDaysMin: 3,
      safeHorizonDaysMax: 60,
    })
  })
})
