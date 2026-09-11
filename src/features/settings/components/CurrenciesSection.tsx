import type { LocalExchangeRate } from '#/db/types'
import { setExchangeRate } from '#/features/settings/data/mutations'
import { SUPPORTED_CURRENCIES } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { SectionHeader } from './SectionHeader'
import { SettingRow } from './SettingRow'
import { RateRow } from './RateRow'
import { Toggle } from './Toggle'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

type Props = {
  base: CurrencyCode
  rates: LocalExchangeRate[]
}

export function CurrenciesSection({ base, rates }: Props) {
  const autoUpdate = usePreferencesStore((s) => s.autoUpdateRates)
  const setAutoUpdate = usePreferencesStore((s) => s.setAutoUpdateRates)

  const rateOf = (code: string): number =>
    rates.find((r) => r.currency === code)?.rate ?? 0
  const baseRate = rateOf(base) || 1
  const others = SUPPORTED_CURRENCIES.filter((c) => c !== base)

  // The user edits "1 X = n base"; persist the absolute rate (units of reference per 1 X),
  // which is the typed display value times the base's own reference rate.
  const commit = (code: CurrencyCode, display: number) =>
    void setExchangeRate(code, display * baseRate)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Currencies & rates"
        subtitle={`Exchange rates used to convert into ${base}.`}
      />
      <div className={CARD}>
        <SettingRow
          label="Auto-update rates"
          desc="Refresh daily from market data."
        >
          <Toggle
            on={autoUpdate}
            onChange={() => setAutoUpdate(!autoUpdate)}
            label="Auto-update rates"
          />
        </SettingRow>

        {others.map((code, i) => (
          <RateRow
            key={code}
            code={code}
            base={base}
            display={(rateOf(code) || 0) / baseRate}
            onCommit={(display) => commit(code, display)}
            last={i === others.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
