import { http } from '#/lib/http'
import { BUNDLED_CONFIG } from './bundledConfig'
import type { AppConfig, CurrencyMeta } from './appConfig'

/**
 * The wire boundary for `GET /config`. Rates arrive as decimal strings for the same reason
 * money does — a float on the wire is a rounding bug waiting to happen — and are parsed to
 * numbers here, once.
 */

type CurrencyWire = {
  code: string
  name: string
  symbol: string
  minor_unit: number
}

type ConfigLimitsWire = {
  import_max_rows: number
  import_max_bytes: number
  email_sync_max_lookback_days: number
  email_sync_max_limit: number
  transaction_bulk_max: number
  integration_keys_max: number
  integration_rules_max: number
  integration_payload_max_bytes: number
  planned_bulk_max?: number
  planned_max?: number
}

export type ConfigWire = {
  version: string
  currencies: CurrencyWire[]
  default_rates: Record<string, string>
  default_base_currency: string
  limits: ConfigLimitsWire
  integrations?: { webhook_url: string | null; webhook_path: string }
}

const toCurrency = (w: CurrencyWire): CurrencyMeta => ({
  code: w.code,
  name: w.name,
  symbol: w.symbol,
  minorUnit: w.minor_unit,
})

const toRates = (wire: Record<string, string>): Record<string, number> => {
  const rates: Record<string, number> = {}
  for (const [code, value] of Object.entries(wire)) {
    const rate = Number(value)
    // An unusable rate is dropped rather than kept as NaN: conversion then falls back to
    // the unknown-pair behaviour instead of poisoning every amount it touches.
    if (Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  return rates
}

export const toAppConfig = (w: ConfigWire): AppConfig => {
  if (!Array.isArray(w.currencies) || w.currencies.length === 0) {
    throw new Error('config: empty currency table')
  }
  return {
    version: w.version,
    currencies: w.currencies.map(toCurrency),
    rates: toRates(w.default_rates),
    defaultBaseCurrency: w.default_base_currency,
    limits: {
      importMaxRows: w.limits.import_max_rows,
      importMaxBytes: w.limits.import_max_bytes,
      emailSyncMaxLookbackDays: w.limits.email_sync_max_lookback_days,
      emailSyncMaxLimit: w.limits.email_sync_max_limit,
      transactionBulkMax: w.limits.transaction_bulk_max,
      integrationKeysMax: w.limits.integration_keys_max,
      integrationRulesMax: w.limits.integration_rules_max,
      integrationPayloadMaxBytes: w.limits.integration_payload_max_bytes,
      // Older servers do not publish these; the bundled floor stands in.
      plannedBulkMax:
        w.limits.planned_bulk_max ?? BUNDLED_CONFIG.limits.plannedBulkMax,
      plannedMax: w.limits.planned_max ?? BUNDLED_CONFIG.limits.plannedMax,
    },
    integrations: w.integrations
      ? {
          webhookUrl: w.integrations.webhook_url,
          webhookPath: w.integrations.webhook_path,
        }
      : BUNDLED_CONFIG.integrations,
  }
}

export const configApi = {
  get: (): Promise<AppConfig> =>
    http.get<ConfigWire>('/config').then(toAppConfig),
}
