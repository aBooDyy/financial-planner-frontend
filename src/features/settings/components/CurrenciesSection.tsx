import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import {
  createCustomCurrency,
  deleteCustomCurrency,
  setExchangeRate,
  updateCustomCurrency,
} from '#/features/settings/data/mutations'
import { useCurrencyRates } from '#/features/settings/hooks/useCurrencyRates'
import type { CurrencyRateRow } from '#/features/settings/hooks/useCurrencyRates'
import { defaultRateFor } from '#/lib/config/rates'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { CustomCurrencyDialog } from './CustomCurrencyDialog'
import type { CustomCurrencyValues } from './CustomCurrencyDialog'
import { CustomCurrencyRow } from './CustomCurrencyRow'
import { RateList } from './RateList'
import { SectionHeader } from './SectionHeader'
import { SettingRow } from './SettingRow'
import { Toggle } from './Toggle'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

type Editing = { id: string; values: CustomCurrencyValues }

const matches = (row: CurrencyRateRow, query: string): boolean => {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return (
    row.code.toLowerCase().includes(q) ||
    row.meta.name.toLowerCase().includes(q)
  )
}

/**
 * Currencies & rates. Every currency is listed, not just the ones the user holds — a rate
 * you can only reach by first holding the money is a rate you can't prepare with — with the
 * held ones sorted to the top and a search over the rest.
 */
export function CurrenciesSection() {
  const { base, rows, customRows, toAbsolute } = useCurrencyRates()
  const autoUpdate = usePreferencesStore((s) => s.autoUpdateRates)
  const setAutoUpdate = usePreferencesStore((s) => s.setAutoUpdateRates)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  // What the user holds is what they came for; the rest is reference, alphabetical.
  const listed = useMemo(
    () =>
      rows
        .filter((row) => row.code !== base && matches(row, query))
        .sort((a, b) =>
          a.held === b.held ? a.code.localeCompare(b.code) : a.held ? -1 : 1,
        ),
    [rows, base, query],
  )

  const commit = (code: CurrencyCode, perBase: number) =>
    void setExchangeRate(code, toAbsolute(perBase))

  const reset = (code: CurrencyCode) => {
    const published = defaultRateFor(code)
    if (published !== undefined) void setExchangeRate(code, published)
  }

  const saveCustom = async (values: CustomCurrencyValues) => {
    const rate = toAbsolute(values.perBase)
    if (editing) {
      await updateCustomCurrency(editing.id, {
        name: values.name,
        symbol: values.symbol,
        rate,
      })
      return
    }
    await createCustomCurrency(values, rate)
  }

  const rowToValues = (row: CurrencyRateRow): CustomCurrencyValues => ({
    code: row.code,
    name: row.meta.name,
    symbol: row.meta.symbol,
    minorUnit: row.meta.minorUnit,
    perBase: row.perBase ?? 0,
  })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Currencies & rates"
        subtitle={`Exchange rates used to convert into ${base}.`}
      />

      <div className={CARD}>
        <SettingRow
          label="Base currency"
          desc="Everything is totalled in this currency."
        >
          <CurrencyPicker
            value={base}
            onChange={(code) => void setBaseCurrency(code)}
            label="Base currency"
            align="end"
            isoOnly
            className="w-auto shrink-0 rounded-[11px] border-fp-border-strong px-3 py-2.5 font-bold"
          />
        </SettingRow>
        <SettingRow
          label="Auto-update rates"
          desc={
            autoUpdate
              ? 'Refreshed from market data when the app opens.'
              : 'Paused — rates stay where they are until you turn this back on.'
          }
        >
          <Toggle
            on={autoUpdate}
            onChange={() => setAutoUpdate(!autoUpdate)}
            label="Auto-update rates"
          />
        </SettingRow>
      </div>

      <div className={CARD}>
        <div className="flex items-center justify-between gap-3 border-b border-fp-border px-[18px] py-[13px]">
          <div className="min-w-0">
            <div className="text-[14px] font-bold">Your currencies</div>
            <div className="text-[12.5px] text-fp-text-3">
              Anything the standard list doesn’t carry. You set the rate.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAdding(true)}
            className="shrink-0 gap-1.5 rounded-[11px] border-fp-border-strong px-[13px] py-[9px] text-[13px] font-semibold"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add
          </Button>
        </div>
        {customRows.length === 0 ? (
          <p className="px-[18px] py-[15px] text-[13px] text-fp-text-3">
            None yet. Add one for points, metals, or anything else you keep
            track of.
          </p>
        ) : (
          customRows.map((row) => (
            <CustomCurrencyRow
              key={row.code}
              row={row}
              base={base}
              onEdit={() =>
                setEditing({ id: row.customId ?? '', values: rowToValues(row) })
              }
              onDelete={() => void deleteCustomCurrency(row.customId ?? '')}
            />
          ))
        )}
      </div>

      <div className={CARD}>
        <div className="flex items-center gap-2 border-b border-fp-border px-[18px] py-[11px]">
          <Search
            size={15}
            strokeWidth={2}
            className="shrink-0 text-fp-text-3"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search currency or code…"
            aria-label="Search currencies"
            className="h-auto border-0 bg-transparent px-0 py-1 text-[14px] shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
          <span className="shrink-0 text-[12px] text-fp-text-3 tabular-nums">
            {listed.length}
          </span>
        </div>
        <RateList rows={listed} base={base} onCommit={commit} onReset={reset} />
      </div>

      {adding ? (
        <CustomCurrencyDialog
          base={base}
          takenCodes={customRows.map((r) => r.code)}
          onSubmit={saveCustom}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing ? (
        <CustomCurrencyDialog
          base={base}
          initial={editing.values}
          takenCodes={customRows.map((r) => r.code)}
          onSubmit={saveCustom}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
