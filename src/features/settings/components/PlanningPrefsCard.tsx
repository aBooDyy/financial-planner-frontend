import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { isoOf } from '#/features/planned/data/dates'
import {
  DEFAULT_HORIZON_DAYS,
  HORIZON_OPTIONS,
  PAYDAY_MODE_OPTIONS,
  VARIES_EXPLAINER,
  clampHorizonDays,
  incomeLookbackStart,
  lowestMonthlyIncome,
} from '#/features/settings/data/planningPrefs'
import type { PaydayMode, SafeHorizon } from '#/features/wallets/api/types'
import { planningSettingsOf } from '#/features/wallets/data/mappers'
import { updatePlanningSettings } from '#/features/wallets/data/mutations'
import { useConfigLimits } from '#/lib/config/appConfig'
import type { RatesMap } from '#/lib/config/rates'
import {
  amountInputProps,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { numericInputProps } from '#/lib/numericInput'
import { Segmented } from './Segmented'
import { SettingRow } from './SettingRow'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const SELECT = 'w-auto max-w-[220px] shrink-0'
const FIELD =
  'rounded-[10px] border-fp-border-strong px-[11px] py-[9px] text-end text-[14px] tabular-nums focus:shadow-[0_0_0_3px_var(--fp-accent-soft)]'
const SUB_ROW =
  'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fp-border bg-fp-surface-2/60 px-[18px] py-[12px]'

type Props = { base: CurrencyCode; rates: RatesMap }

/**
 * Settings › Preferences › Planning (05): the Safe-to-spend window, what happens when pay
 * arrives, and income that varies. Synced settings — every change is one full PATCH.
 */
export function PlanningPrefsCard({ base, rates }: Props) {
  const row = useLiveQuery(() => db.balanceSettings.get(SETTINGS_KEY))
  const s = planningSettingsOf(row)
  const limits = useConfigLimits()

  const setHorizon = (safeHorizon: SafeHorizon) =>
    void updatePlanningSettings({
      safeHorizon,
      safeHorizonDays:
        safeHorizon === 'days'
          ? (s.safeHorizonDays ?? DEFAULT_HORIZON_DAYS)
          : null,
    })

  const setVaries = async (varies: boolean) => {
    if (!varies) return updatePlanningSettings({ incomeVaries: false })
    const today = isoOf(new Date())
    const recent = await db.transactions
      .where('date')
      .between(incomeLookbackStart(today), today, true, true)
      .toArray()
    await updatePlanningSettings({
      incomeVaries: true,
      incomeFloor:
        s.incomeFloor ?? lowestMonthlyIncome(recent, today, base, rates),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="px-1 text-[12px] font-extrabold tracking-[0.06em] text-fp-text-3 uppercase">
        Planning
      </div>
      <div className={CARD}>
        <SettingRow
          label="Safe to spend"
          desc="How far ahead Wallets looks when it works out what is safe to spend."
        >
          <Select
            value={s.safeHorizon}
            onValueChange={(v) => setHorizon(v as SafeHorizon)}
          >
            <SelectTrigger className={SELECT} aria-label="Safe to spend window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        {s.safeHorizon === 'days' ? (
          <HorizonDaysRow
            days={s.safeHorizonDays ?? DEFAULT_HORIZON_DAYS}
            min={limits.safeHorizonDaysMin}
            max={limits.safeHorizonDaysMax}
          />
        ) : null}

        <SettingRow
          label="When your pay arrives"
          desc="Set-asides wait for you to review them, or are made on payday."
        >
          <Select
            value={s.paydayMode}
            onValueChange={(v) =>
              void updatePlanningSettings({ paydayMode: v as PaydayMode })
            }
          >
            <SelectTrigger
              className={SELECT}
              aria-label="When your pay arrives"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYDAY_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="My income"
          desc="Most pay arrives steadily. Choose Varies if yours doesn’t."
          last={!s.incomeVaries}
        >
          <Segmented
            value={s.incomeVaries ? 'varies' : 'steady'}
            onChange={(v) => void setVaries(v === 'varies')}
            options={[
              { value: 'steady', label: 'Steady' },
              { value: 'varies', label: 'Varies' },
            ]}
          />
        </SettingRow>
        {s.incomeVaries ? (
          <IncomeFloorRow floor={s.incomeFloor} base={base} />
        ) : null}
      </div>
    </div>
  )
}

/** "Next [14] days", held to the server's bounds when it is saved. */
function HorizonDaysRow({
  days,
  min,
  max,
}: {
  days: number
  min: number
  max: number
}) {
  const [text, setText] = useState(String(days))
  useEffect(() => setText(String(days)), [days])
  const commit = () => {
    const next = clampHorizonDays(text, min, max)
    if (next === null || next === days) return setText(String(days))
    setText(String(next))
    void updatePlanningSettings({ safeHorizon: 'days', safeHorizonDays: next })
  }
  return (
    <div className={SUB_ROW}>
      <span className="text-[13px] font-semibold text-fp-text-2">Next</span>
      <Input
        value={text}
        aria-label="Days ahead"
        {...numericInputProps({ decimals: 0 }, setText)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={`w-[72px] ${FIELD}`}
      />
      <span className="text-[13px] font-semibold text-fp-text-2">days</span>
      <span className="text-[12px] text-fp-text-3">
        {min}–{max} days
      </span>
    </div>
  )
}

const floorText = (floor: number | null, base: CurrencyCode): string =>
  floor === null ? '' : minorToInputValue(floor, base)

/** "Plan with at least SR [ ] a month", and why. */
function IncomeFloorRow({
  floor,
  base,
}: {
  floor: number | null
  base: CurrencyCode
}) {
  const [text, setText] = useState(floorText(floor, base))
  useEffect(() => setText(floorText(floor, base)), [floor, base])
  const commit = () => {
    const parsed = parseAmountToMinor(text, base)
    const next = parsed !== null && parsed > 0 ? parsed : null
    if (next === floor) return setText(floorText(floor, base))
    void updatePlanningSettings({ incomeFloor: next })
  }
  return (
    <div className="flex flex-col gap-3 px-[18px] pt-[4px] pb-[15px]">
      <p className="text-[12.5px] text-fp-text-3">{VARIES_EXPLAINER}</p>
      <label className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13.5px] font-semibold">Plan with at least</span>
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-fp-text-3">{base}</span>
          <Input
            aria-label="Plan with at least, a month"
            {...amountInputProps(base, text, setText)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className={`fp-sensitive w-[132px] ${FIELD}`}
          />
          <span className="text-[13px] text-fp-text-2">a month</span>
        </span>
      </label>
    </div>
  )
}
