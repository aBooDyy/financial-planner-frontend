import { useMemo } from 'react'
import { useWallets } from '#/features/wallets/hooks/useWallets'
import { useCurrencyList } from '#/lib/config/appConfig'
import type { CurrencyMeta, CustomCurrencyMeta } from '#/lib/config/appConfig'
import {
  defaultRateFor,
  isRateOverridden,
  useMergedRates,
} from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'

/**
 * One currency as the rates screen needs it. `perBase` is what the row shows and edits —
 * "1 CODE = n BASE" — while the stored rate is always against the app's own reference, so
 * switching base re-reads every row without rewriting a single one.
 */
export type CurrencyRateRow = {
  meta: CurrencyMeta
  code: CurrencyCode
  /** Units of the base per 1 unit. Null when nothing prices this currency. */
  perBase: number | null
  /** The same figure before the user's override, for the "reset to" line. */
  defaultPerBase: number | null
  edited: boolean
  held: boolean
  /** The synced row's id — set only for one of the user's own currencies. */
  customId: string | null
}

export type CurrencyRates = {
  base: CurrencyCode
  rows: CurrencyRateRow[]
  /** The user's own currencies, which get their own section and their own editor. */
  customRows: CurrencyRateRow[]
  /** Turns a typed "per 1 unit of base" figure into the absolute rate that is stored. */
  toAbsolute: (perBase: number) => number
}

export function useCurrencyRates(): CurrencyRates {
  const { base, rateRows, held } = useWallets()
  const currencies = useCurrencyList()
  const merged = useMergedRates(rateRows)

  return useMemo(() => {
    const overrideOf = new Map(rateRows.map((r) => [r.currency, r.rate]))
    const heldSet = new Set(held)
    // Every row is quoted against the base, so each divides by the base's own rate.
    const baseRate = merged[base]
    const baseDefault = defaultRateFor(base)

    const against = (rate: number | undefined, unit: number | undefined) =>
      rate !== undefined && unit ? rate / unit : null

    const toRow = (meta: CurrencyMeta): CurrencyRateRow => {
      const override = overrideOf.get(meta.code)
      return {
        meta,
        code: meta.code,
        perBase: against(merged[meta.code], baseRate),
        defaultPerBase: against(defaultRateFor(meta.code), baseDefault),
        edited: override !== undefined && isRateOverridden(meta.code, override),
        held: heldSet.has(meta.code),
        customId: meta.custom === true ? (meta as CustomCurrencyMeta).id : null,
      }
    }

    const all = currencies.map(toRow)
    return {
      base,
      rows: all.filter((r) => r.customId === null),
      customRows: all.filter((r) => r.customId !== null),
      toAbsolute: (perBase: number) => perBase * (baseRate ?? 1),
    }
  }, [base, currencies, held, merged, rateRows])
}
