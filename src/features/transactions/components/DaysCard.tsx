import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from 'lucide-react'
import { useDragControls } from 'motion/react'
import { useCalendarSlide } from '#/features/transactions/hooks/useCalendarSlide'
import type { RangeMode } from '#/features/transactions/constants'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import type { CalendarView } from '#/features/transactions/data/selectors'
import type { PeriodOnScreen } from '#/features/transactions/hooks/useSpendingViews'
import { DayGrid } from './DayGrid'
import { MonthGrid } from './MonthGrid'
import { PeriodModeSwitch } from './PeriodModeSwitch'
import { PeriodSlide } from './PeriodSlide'
import { WeekdayLabels } from './WeekdayLabels'

type Props = {
  calendar: CalendarView
  /** The period's figures are still loading: the grid draws its days, not their values. */
  loading: boolean
  period: PeriodOnScreen
  calOpen: boolean
  onSetMode: (m: RangeMode) => void
  onPickCustom: (span: IsoSpan) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onToggleCal: () => void
  onPickDay: (key: string) => void
  onPickMonth: (key: string) => void
}

const STEP =
  'flex h-8 w-8 items-center justify-center rounded-[9px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-text'

export function DaysCard({
  calendar,
  loading,
  period,
  calOpen,
  onSetMode,
  onPickCustom,
  onPrev,
  onNext,
  onToday,
  onToggleCal,
  onPickDay,
  onPickMonth,
}: Props) {
  const dragControls = useDragControls()
  const { mode, todayIs } = period
  const slide = useCalendarSlide(calendar, mode)
  const unit =
    mode === 'custom' ? 'range' : calendar.grid === 'months' ? 'year' : 'month'
  const expandTitle = calOpen
    ? `Fold the ${unit} back`
    : `Unfold the full ${unit}`

  return (
    <div
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') dragControls.start(e)
      }}
      className="@container touch-pan-y rounded-[18px] border border-fp-border bg-fp-surface p-[14px] shadow-fp"
    >
      <div className="flex flex-wrap items-center gap-[10px]">
        <PeriodModeSwitch
          mode={mode}
          shown={period}
          onSetMode={onSetMode}
          onPickCustom={onPickCustom}
        />
        <div className="hidden min-w-[8px] flex-1 @xl:block" />
        <div className="flex w-full items-center gap-1 @xl:w-auto">
          <button type="button" onClick={onPrev} className={STEP}>
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <div className="flex flex-1 items-center justify-center @xl:contents">
            {todayIs ? (
              <TodayButton direction={todayIs} onClick={onToday} />
            ) : null}
            <div className="min-w-[132px] text-center text-[14px] font-bold">
              {period.label}
            </div>
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

        {calendar.grid === 'days' ? (
          <WeekdayLabels labels={calendar.weekdayLabels} />
        ) : null}
        <PeriodSlide
          slide={slide}
          dragControls={dragControls}
          onStep={(step) => (step === 1 ? onNext() : onPrev())}
        >
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
        </PeriodSlide>
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
      className="me-1 inline-flex h-8 animate-in @xl:-order-1 items-center gap-[5px] rounded-full border border-fp-accent/40 bg-fp-accent-soft px-3 text-[12.5px] font-bold text-fp-accent-ink duration-200 fade-in zoom-in-95 hover:border-fp-accent"
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
