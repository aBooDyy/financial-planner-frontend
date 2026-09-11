import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { RED } from '#/features/transactions/constants'
import type { RangeMode } from '#/features/transactions/constants'
import type {
  CalendarView,
  DayCell,
} from '#/features/transactions/data/selectors'

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
}

const seg = (active: boolean) =>
  `rounded-[8px] px-3 py-[6px] text-[12.5px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

function Cell({ d, onPick }: { d: DayCell; onPick: (key: string) => void }) {
  let bg =
    d.hasActivity && d.spendStr !== '−0' ? undefined : 'var(--fp-surface-2)'
  let border = '1px solid var(--fp-border)'
  let numColor = d.inMonth ? 'var(--fp-text-2)' : 'var(--fp-text-3)'
  let netColor = d.inMonth
    ? d.netPositive
      ? 'var(--fp-accent)'
      : RED
    : 'var(--fp-text-3)'
  let incColor = d.inMonth ? 'var(--fp-accent)' : 'var(--fp-text-3)'
  let spendColor = d.inMonth ? RED : 'var(--fp-text-3)'

  // Spend heat (red wash scaled by intensity), matching the design.
  const spendVal = Number(d.spendStr.replace(/[^\d.]/g, ''))
  if (spendVal > 0)
    bg = `rgba(229,72,77,${(0.07 + 0.2 * d.intensity).toFixed(3)})`

  if (d.isSelected) {
    bg = 'var(--fp-accent)'
    border = '1px solid var(--fp-accent)'
    numColor = '#fff'
    netColor = '#fff'
    incColor = 'rgba(255,255,255,0.92)'
    spendColor = 'rgba(255,255,255,0.92)'
  } else if (d.inWeekWindow) {
    bg = 'var(--fp-accent-soft)'
    border = '1px solid var(--fp-accent)'
    numColor = 'var(--fp-accent-ink)'
  } else if (d.isToday) {
    border = '1.5px solid var(--fp-text-3)'
    numColor = 'var(--fp-text)'
  }

  return (
    <button
      type="button"
      onClick={() => onPick(d.key)}
      className="flex h-[52px] flex-col items-start justify-start gap-px overflow-hidden rounded-[9px] px-[5px] py-1 md:h-[58px] md:px-[7px]"
      style={{ background: bg, border, opacity: d.inMonth ? 1 : 0.5 }}
    >
      <span
        className="text-[10.5px] leading-[1.1] tabular-nums md:text-[12px]"
        style={{ color: numColor, fontWeight: d.isToday ? 800 : 600 }}
      >
        {d.dayLabel}
      </span>
      {d.hasActivity ? (
        <span
          className="mt-px text-[10px] font-extrabold leading-[1.1] tabular-nums md:text-[12px]"
          style={{ color: netColor }}
        >
          {d.netStr}
        </span>
      ) : null}
      {d.hasBoth ? (
        <div className="flex items-center gap-1 leading-none">
          <span
            className="text-[8.5px] font-bold tabular-nums md:text-[10px]"
            style={{ color: incColor }}
          >
            {d.incStr}
          </span>
          <span
            className="text-[8.5px] font-bold tabular-nums md:text-[10px]"
            style={{ color: spendColor }}
          >
            {d.spendStr}
          </span>
        </div>
      ) : null}
    </button>
  )
}

const Row = ({
  days,
  onPick,
}: {
  days: DayCell[]
  onPick: (k: string) => void
}) => (
  <div className="grid grid-cols-7 gap-[6px]">
    {days.map((d) => (
      <Cell key={d.key} d={d} onPick={onPick} />
    ))}
  </div>
)

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
}: Props) {
  const anim = 'max-height .36s cubic-bezier(.22,.78,.27,1), opacity .26s ease'
  const beforeStyle = {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end' as const,
    maxHeight: calOpen ? `${calendar.weeksBefore.length * 64 + 6}px` : '0px',
    opacity: calOpen ? 1 : 0,
    transition: anim,
  }
  const afterStyle = {
    overflow: 'hidden',
    maxHeight: calOpen ? `${calendar.weeksAfter.length * 64 + 6}px` : '0px',
    opacity: calOpen ? 1 : 0,
    transition: anim,
  }

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[14px] shadow-fp">
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="inline-flex rounded-[11px] border border-fp-border bg-fp-surface-2 p-[3px]">
          {(['month', 'week', 'day'] as RangeMode[]).map((m) => (
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
          <button
            type="button"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-text"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <div className="min-w-[132px] text-center text-[14px] font-bold">
            {periodLabel}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-text"
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mt-[14px]">
        <div className="mb-[9px] flex items-center justify-between gap-2">
          <div className="text-[11.5px] font-semibold text-fp-text-3">
            {calendar.caption}
          </div>
          {calendar.isMonth ? (
            <button
              type="button"
              onClick={onToggleCal}
              title={calOpen ? 'Collapse to week' : 'Unfold full month'}
              className="flex h-[26px] w-[30px] items-center justify-center rounded-[8px] border border-fp-border-strong bg-fp-surface-2 text-fp-text-2 hover:text-fp-accent-ink"
            >
              <ChevronsUpDown size={16} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <div className="mb-[6px] grid grid-cols-7 gap-[6px]">
          {calendar.weekdayLabels.map((w) => (
            <div
              key={w}
              className="text-center text-[10.5px] font-bold uppercase tracking-[0.03em] text-fp-text-3"
            >
              {w}
            </div>
          ))}
        </div>

        {calendar.isMonth ? (
          <div style={beforeStyle}>
            {calendar.weeksBefore.map((days, i) => (
              <div key={i} className="mb-[6px]">
                <Row days={days} onPick={onPickDay} />
              </div>
            ))}
          </div>
        ) : null}

        <Row days={calendar.pivotWeek} onPick={onPickDay} />

        {calendar.isMonth ? (
          <div style={afterStyle}>
            {calendar.weeksAfter.map((days, i) => (
              <div key={i} className="mt-[6px]">
                <Row days={days} onPick={onPickDay} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
