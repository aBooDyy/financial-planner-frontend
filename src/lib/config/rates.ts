import { customCurrencies, getAppConfig, useAppConfigStore } from './appConfig'
import type { CustomCurrencyMeta } from './appConfig'

/**
 * Rates are "units of a common reference per 1 unit of the currency" (see `convertMinor`).
 * Three sources feed one map, each beating the one before it: the config seed shipped with
 * the deploy, the rate a user-defined currency carries on its own row, and the user's
 * override rows. A currency in none of them has no rate at all, and conversion through it
 * stays undefined rather than invented.
 */

export type RatesMap = Partial<Record<string, number>>

export type RateOverride = { currency: string; rate: number }

const withOverrides = (
  defaults: Record<string, number>,
  custom: ReadonlyArray<CustomCurrencyMeta>,
  overrides: ReadonlyArray<RateOverride>,
): RatesMap => {
  const merged: RatesMap = { ...defaults }
  for (const currency of custom) merged[currency.code] = currency.rate
  for (const row of overrides) merged[row.currency] = row.rate
  return merged
}

export const mergeRates = (
  overrides: ReadonlyArray<RateOverride> = [],
): RatesMap =>
  withOverrides(getAppConfig().rates, customCurrencies(), overrides)

/** Reactive form for hooks: re-derives when a config refresh or a currency edit lands. */
export const useMergedRates = (
  overrides: ReadonlyArray<RateOverride> = [],
): RatesMap =>
  withOverrides(
    useAppConfigStore((s) => s.config.rates),
    useAppConfigStore((s) => s.custom),
    overrides,
  )

/**
 * The rate this currency has before any override of the user's: the shipped seed for an ISO
 * code, and for one of their own currencies the rate the currency itself carries.
 */
export const defaultRateFor = (code: string): number | undefined =>
  getAppConfig().rates[code] ??
  customCurrencies().find((c) => c.code === code)?.rate

/** Whether the user's row differs from the shipped default — i.e. it is a real override. */
export const isRateOverridden = (code: string, rate: number): boolean => {
  const fallback = defaultRateFor(code)
  return fallback === undefined || Math.abs(fallback - rate) > 1e-9
}
