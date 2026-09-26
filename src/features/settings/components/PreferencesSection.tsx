import { CurrencyPicker } from '#/components/CurrencyPicker'
import { setBaseCurrency } from '#/features/wallets/data/mutations'
import { useWallets } from '#/features/wallets/hooks/useWallets'
import type { CurrencyCode } from '#/lib/currency'
import { DATE_FORMAT_OPTIONS } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { useThemeStore } from '#/stores/theme'
import type { ThemePreference } from '#/stores/theme'
import { usePreferencesStore } from '#/stores/preferences'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { SectionHeader } from './SectionHeader'
import { SettingRow } from './SettingRow'
import { Segmented } from './Segmented'
import { Toggle } from './Toggle'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const SELECT = 'w-auto shrink-0'

const DEFAULT_ACCOUNT_NONE = '__none__'

export function PreferencesSection() {
  const { base, nodes } = useWallets()
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const p = usePreferencesStore()

  const wallets = nodes.filter((n) => n.kind === 'wallet')
  const onBaseChange = (code: CurrencyCode) => void setBaseCurrency(code)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Preferences"
        subtitle="How Means looks and behaves on this device."
      />
      <div className={CARD}>
        <SettingRow label="Appearance" desc="Theme used across Means.">
          <Segmented<ThemePreference>
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </SettingRow>

        <SettingRow
          label="Base currency"
          desc="Everything is totalled in this currency."
        >
          <CurrencyPicker
            value={base}
            onChange={onBaseChange}
            label="Base currency"
            align="end"
            className={`${SELECT} font-bold`}
          />
        </SettingRow>

        <SettingRow label="Number format" desc="Thousands and decimal style.">
          <Segmented
            value={p.numberFormat}
            onChange={p.setNumberFormat}
            options={[
              { value: '1,234.56', label: '1,234.56' },
              { value: '1.234,56', label: '1.234,56' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Date format" desc="How specific dates are shown.">
          <Select
            value={p.dateFormat}
            onValueChange={(v) => p.setDateFormat(v as DateFormat)}
          >
            <SelectTrigger className={`${SELECT} tabular-nums`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Week starts on"
          desc="Used by the spending calendar."
        >
          <Segmented
            value={p.weekStart}
            onChange={p.setWeekStart}
            options={[
              { value: 'Sunday', label: 'Sunday' },
              { value: 'Monday', label: 'Monday' },
            ]}
          />
        </SettingRow>

        <SettingRow
          label="Default account"
          desc="Pre-selected when adding a transaction."
        >
          <Select
            value={p.defaultAccountId ?? DEFAULT_ACCOUNT_NONE}
            onValueChange={(v) =>
              p.setDefaultAccountId(v === DEFAULT_ACCOUNT_NONE ? null : v)
            }
          >
            <SelectTrigger className={`${SELECT} max-w-[200px] truncate`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_ACCOUNT_NONE}>None</SelectItem>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Hide empty wallets"
          desc="Keep zero-balance wallets out of lists."
          last
        >
          <Toggle
            on={p.hideEmptyWallets}
            onChange={() => p.setHideEmptyWallets(!p.hideEmptyWallets)}
            label="Hide empty wallets"
          />
        </SettingRow>
      </div>
    </div>
  )
}
