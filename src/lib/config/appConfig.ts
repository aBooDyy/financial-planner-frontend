import { useMemo } from 'react'
import { create } from 'zustand'
import { BUNDLED_CONFIG } from './bundledConfig'

/**
 * The app config published by `GET /config`: the ISO-4217 currency table, the seed FX
 * rates, and the caps the server enforces. It is static per deploy, so it is read through
 * a plain store rather than the synced local DB — `useAppConfig` fills it in on open.
 */

export type CurrencyMeta = {
  code: string
  name: string
  symbol: string
  /** ISO-4217 minor-unit exponent: 0 (JPY), 2 (most), 3 (KWD). Sizes every amount. */
  minorUnit: number
  /** True for a currency the user defined. It carries its own rate and can't be the base. */
  custom?: boolean
}

/** One of the user's own currencies, as the rest of the app needs to see it. `id` is the
 *  synced row's, which is what an edit or a delete addresses. */
export type CustomCurrencyMeta = CurrencyMeta & {
  custom: true
  id: string
  rate: number
}

export type ConfigLimits = {
  importMaxRows: number
  importMaxBytes: number
  emailSyncMaxLookbackDays: number
  emailSyncMaxLimit: number
  /** How many transactions one `POST /transactions/bulk` may carry. */
  transactionBulkMax: number
  integrationKeysMax: number
  /** How many rules one integration key may hold. */
  integrationRulesMax: number
  /** The largest body the webhook endpoint (and the rule tester) accepts, in bytes. */
  integrationPayloadMaxBytes: number
}

/** Where integrations post. `webhookUrl` is set only when the deployment names its public origin. */
export type IntegrationsConfig = {
  webhookUrl: string | null
  webhookPath: string
}

export type AppConfig = {
  version: string
  currencies: CurrencyMeta[]
  /** Seed rates: units of the reference currency per 1 unit. A currency with no sensible
   *  static rate is simply absent, and conversion through it stays undefined. */
  rates: Record<string, number>
  defaultBaseCurrency: string
  limits: ConfigLimits
  integrations: IntegrationsConfig
}

type ConfigState = {
  config: AppConfig
  /** The user's own currencies, mirrored here from the local DB by `useCustomCurrencies`. */
  custom: CustomCurrencyMeta[]
  /** Every currency the user may hold money in, indexed by code. */
  byCode: Map<string, CurrencyMeta>
  /** The config version the rates in use came from — behind `version` while rates are pinned. */
  ratesVersion: string
  applyConfig: (config: AppConfig, keepRates?: boolean) => void
  applyCustomCurrencies: (custom: CustomCurrencyMeta[]) => void
}

/**
 * The lookup every synchronous currency helper reads. A user-defined code is a currency
 * everywhere the app handles money — `decimalsFor` sizes its amounts and `fromWireCurrency`
 * lets its rows through the wire gate — so it belongs in the same index as an ISO code.
 */
const indexOf = (
  config: AppConfig,
  custom: CustomCurrencyMeta[],
): Map<string, CurrencyMeta> => {
  const byCode = new Map<string, CurrencyMeta>(
    config.currencies.map((c) => [c.code, c]),
  )
  for (const c of custom) byCode.set(c.code, c)
  return byCode
}

/**
 * A user-defined code that collides with an ISO one is dropped here, once, rather than at
 * each of the three places that read the set — the currency index, the pickers and the
 * rates map. The server refuses to create one; this is what keeps a stale local row, or a
 * currency the ISO table adopted later, from restating the real currency's rate.
 */
const usable = (
  config: AppConfig,
  custom: CustomCurrencyMeta[],
): CustomCurrencyMeta[] => {
  const iso = new Set(config.currencies.map((c) => c.code))
  return custom.filter((c) => !iso.has(c.code))
}

export const useAppConfigStore = create<ConfigState>((set, get) => ({
  config: BUNDLED_CONFIG,
  custom: [],
  byCode: indexOf(BUNDLED_CONFIG, []),
  ratesVersion: BUNDLED_CONFIG.version,
  /**
   * `version` changes whenever the published config does — including when the rates move —
   * so an identical stamp means nothing to redo. `keepRates` is the "Auto-update rates"
   * preference turned off: the currency table and limits still refresh, but the rates the
   * user is converting at stay exactly where they were. `ratesVersion` records how far
   * behind they are, so turning the preference back on takes the next refresh.
   */
  applyConfig: (config, keepRates = false) => {
    const current = get()
    const pinned = keepRates && config.version !== current.ratesVersion
    if (
      config.version === current.config.version &&
      (pinned || current.ratesVersion === config.version)
    ) {
      return
    }
    const next = pinned ? { ...config, rates: current.config.rates } : config
    const custom = usable(next, current.custom)
    set({
      config: next,
      custom,
      byCode: indexOf(next, custom),
      ratesVersion: pinned ? current.ratesVersion : config.version,
    })
  },
  applyCustomCurrencies: (incoming) => {
    const { config, custom: current } = get()
    const custom = usable(config, incoming)
    if (sameCurrencies(current, custom)) return
    set({ custom, byCode: indexOf(config, custom) })
  },
}))

/** A live query re-emits on any local write, so the index is rebuilt only on a real change. */
const sameCurrencies = (
  a: CustomCurrencyMeta[],
  b: CustomCurrencyMeta[],
): boolean =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i]
    return (
      x.id === y.id &&
      x.code === y.code &&
      x.name === y.name &&
      x.symbol === y.symbol &&
      x.minorUnit === y.minorUnit &&
      x.rate === y.rate
    )
  })

export const getAppConfig = (): AppConfig => useAppConfigStore.getState().config

export const currencyMeta = (code: string): CurrencyMeta | undefined =>
  useAppConfigStore.getState().byCode.get(code)

/** Every currency the user can pick: the ISO table plus their own, theirs first. */
export const currencyList = (): CurrencyMeta[] => [
  ...useAppConfigStore.getState().custom,
  ...getAppConfig().currencies,
]

/** The user's own currencies and their rates — folded into every rates map. */
export const customCurrencies = (): CustomCurrencyMeta[] =>
  useAppConfigStore.getState().custom

export const configLimits = (): ConfigLimits => getAppConfig().limits

/** Reactive reads for components that must re-render when a refresh lands. */
export const useCurrencyList = (): CurrencyMeta[] => {
  const iso = useAppConfigStore((s) => s.config.currencies)
  const custom = useAppConfigStore((s) => s.custom)
  return useMemo(() => [...custom, ...iso], [custom, iso])
}

export const useCustomCurrencyList = (): CustomCurrencyMeta[] =>
  useAppConfigStore((s) => s.custom)

export const useConfigLimits = (): ConfigLimits =>
  useAppConfigStore((s) => s.config.limits)

export const useIntegrationsConfig = (): IntegrationsConfig =>
  useAppConfigStore((s) => s.config.integrations)
