import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import type { RangeMode } from '#/features/transactions/constants'
import type { CalendarView } from '#/features/transactions/data/selectors'
import { DayGrid } from './DayGrid'
import { MonthGrid } from './MonthGrid'

type Props = {
  calendar: CalendarView
  mode: RangeMode
  periodLabel: string
  calOpen: boolean
  onSetMode: (m: RangeMode) => void
  onPrev: () => void
  onNext: () => void
  onToggleCal: () => void
  onPickDay: (key: string) => void
  onPickMonth: (key: string) => void
}

const MODES: RangeMode[] = ['year', 'month', 'week', 'day']

const seg = (active: boolean) =>
  `rounded-[8px] px-3 py-[6px] text-[12.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

const STEP =
  'flex h-8 w-8 items-center justify-center rounded-[9px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-text'

export function DaysCard({
  calendar,
  mode,
  periodLabel,
  calOpen,
  onSetMode,
  onPrev,
  onNext,
  onToggleCal,
  onPickDay,
  onPickMonth,
}: Props) {
  const unit = calendar.grid === 'months' ? 'year' : 'month'
  const expandTitle = calOpen
    ? `Fold the ${unit} back`
    : `Unfold the full ${unit}`

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[14px] shadow-fp">
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="inline-flex rounded-[11px] border border-fp-border bg-fp-surface-2 p-[3px]">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSetMode(m)}
              className={seg(mode === m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="min-w-[8px] flex-1" />
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrev} className={STEP}>
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <div className="min-w-[132px] text-center text-[14px] font-bold">
            {periodLabel}
          </div>
          <button type="button" onClick={onNext} className={STEP}>
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mt-[14px]">
        <div className="mb-[9px] flex items-center justify-between gap-2">
          <div className="text-[11.5px] font-semibold text-fp-text-3">
            {calendar.caption}
          </div>
          <button
            type="button"
            onClick={onToggleCal}
            title={expandTitle}
            aria-label={expandTitle}
            aria-expanded={calOpen}
            className="flex h-[26px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-accent-ink"
          >
            <ChevronsUpDown size={16} strokeWidth={2} />
          </button>
        </div>

        {calendar.grid === 'months' ? (
          <MonthGrid grid={calendar} open={calOpen} onPick={onPickMonth} />
        ) : (
          <DayGrid grid={calendar} open={calOpen} onPick={onPickDay} />
        )}
      </div>
    </div>
  )
}
