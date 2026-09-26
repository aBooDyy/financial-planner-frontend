import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from 'lucide-react'
import { useSwipe } from '#/hooks/useSwipe'
import type { RangeMode } from '#/features/transactions/constants'
import type { CalendarView } from '#/features/transactions/data/selectors'
import { DayGrid } from './DayGrid'
import { MonthGrid } from './MonthGrid'

type Props = {
  calendar: CalendarView
  /** The period's figures are still loading: the grid draws its days, not their values. */
  loading: boolean
  mode: RangeMode
  periodLabel: string
  calOpen: boolean
  onSetMode: (m: RangeMode) => void
  onPrev: () => void
  onNext: () => void
  /** Where today sits relative to the period in view; `null` while it's inside it. */
  todayIs: 'ahead' | 'behind' | null
  onToday: () => void
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
  loading,
  mode,
  periodLabel,
  calOpen,
  onSetMode,
  onPrev,
  onNext,
  todayIs,
  onToday,
  onToggleCal,
  onPickDay,
  onPickMonth,
}: Props) {
  const swipe = useSwipe((step) => (step === 1 ? onNext() : onPrev()))
  const unit = calendar.grid === 'months' ? 'year' : 'month'
  const expandTitle = calOpen
    ? `Fold the ${unit} back`
    : `Unfold the full ${unit}`

  return (
    <div
      {...swipe}
      className="touch-pan-y rounded-[18px] border border-fp-border bg-fp-surface p-[14px] shadow-fp"
    >
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
          {todayIs ? (
            <TodayButton direction={todayIs} onClick={onToday} />
          ) : null}
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
          <MonthGrid
            grid={calendar}
            open={calOpen}
            loading={loading}
            onPick={onPickMonth}
          />
        ) : (
          <DayGrid
            grid={calendar}
            open={calOpen}
            loading={loading}
            onPick={onPickDay}
          />
        )}
      </div>
    </div>
  )
}

/** Jumps back to the period holding today; the arrow points the way today lies. */
function TodayButton({
  direction,
  onClick,
}: {
  direction: 'ahead' | 'behind'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Jump to today"
      className="me-1 inline-flex h-8 animate-in items-center gap-[5px] rounded-full border border-fp-accent/40 bg-fp-accent-soft px-3 text-[12.5px] font-bold text-fp-accent-ink duration-200 fade-in zoom-in-95 hover:border-fp-accent"
    >
      {direction === 'behind' ? (
        <ArrowLeft size={14} strokeWidth={2.4} />
      ) : null}
      Today
      {direction === 'ahead' ? (
        <ArrowRight size={14} strokeWidth={2.4} />
      ) : null}
    </button>
  )
}
