import { useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, PencilLine } from 'lucide-react'
import { MenuSelect } from '#/components/MenuSelect'
import { CustomRangeDialog } from '#/features/transactions/components/CustomRangeDialog'
import { ymd } from '#/features/transactions/data/planning'
import {
  COMPARISONS,
  COMPARISON_LABEL,
  RANGE_PRESETS,
  presetLabel,
} from '#/features/reports/data/range'
import type { ReportRange } from '#/features/reports/data/range'
import type { ReportControls } from '#/features/reports/hooks/useReportControls'

type Props = {
  controls: ReportControls
  range: ReportRange
  today: Date
  /** Joins the row on mobile, where the page header leaves it out. */
  scopePicker: ReactNode
}

const COMPARISON_OPTIONS = COMPARISONS.map((value) => ({
  value,
  label: COMPARISON_LABEL[value],
}))

/** The period (a preset or a custom span), the account filter on mobile, the comparison. */
export function RangeControls({ controls, range, today, scopePicker }: Props) {
  const [picking, setPicking] = useState(false)
  const presets = RANGE_PRESETS.map((value) => ({
    value,
    label: presetLabel(value, today),
  }))
  const isCustom = controls.preset === 'custom'

  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <MenuSelect
        appearance="prominent"
        title="Choose the period"
        icon={
          <CalendarDays
            size={16}
            strokeWidth={1.9}
            className="flex-none text-fp-text-2"
          />
        }
        value={controls.preset}
        options={presets}
        onChange={(preset) =>
          preset === 'custom' ? setPicking(true) : controls.setPreset(preset)
        }
      />
      {isCustom ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-[7px] rounded-[10px] border border-fp-border-strong bg-fp-surface px-[10px] py-2 text-[13px] font-semibold text-fp-text hover:bg-fp-surface-2"
        >
          {range.caption}
          <PencilLine size={14} strokeWidth={2} className="text-fp-text-3" />
        </button>
      ) : (
        <span className="text-[13px] font-semibold text-fp-text-3">
          {range.caption}
        </span>
      )}
      <div className="flex-1" />
      <div className="md:hidden">{scopePicker}</div>
      <MenuSelect
        title="Compare with"
        value={controls.comparison}
        options={COMPARISON_OPTIONS}
        onChange={controls.setComparison}
      />
      {picking ? (
        <CustomRangeDialog
          initial={{ start: ymd(range.start), end: ymd(range.end) }}
          onPick={controls.pickCustom}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  )
}
