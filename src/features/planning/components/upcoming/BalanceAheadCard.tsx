import { useState } from 'react'
import type { PointerEvent } from 'react'
import { RailCardHeader } from '#/components/RailCardHeader'
import { Skeleton } from '#/components/ui/skeleton'
import type { CurrencyCode } from '#/lib/currency'
import type { BalanceAhead } from '#/features/planning/view/ahead'
import { AHEAD_DAYS } from '#/features/planning/view/ahead'
import { dayMonth, signedMoney } from '#/features/planning/view/format'

const W = 300
const H = 120
const PAD = 8

type Props = { view: BalanceAhead | null; base: CurrencyCode }

/**
 * Balance ahead: Balance (thin) and Free to spend (accent) over the next 30 days, a dashed
 * line on each payday; hover or drag reads a day. The time axis runs left to right in both
 * directions, as charts do.
 */
export function BalanceAheadCard({ view, base }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader title="Balance ahead" sub={`Next ${AHEAD_DAYS} days`} />
      {view === null ? (
        <Skeleton className="h-[120px] rounded-[10px]" />
      ) : (
        <Chart view={view} base={base} picked={picked} onPick={setPicked} />
      )}
    </div>
  )
}

function Chart({
  view,
  base,
  picked,
  onPick,
}: {
  view: BalanceAhead
  base: CurrencyCode
  picked: number | null
  onPick: (i: number | null) => void
}) {
  const values = view.days.flatMap((d) => [d.balance, d.free])
  const lo = Math.min(0, ...values)
  const hi = Math.max(...values, lo + 1)
  const x = (i: number) => PAD + (i / AHEAD_DAYS) * (W - PAD * 2)
  const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - PAD * 2)
  const line = (key: 'balance' | 'free') =>
    view.days.map((d, i) => `${x(i)},${y(d[key])}`).join(' ')
  const shown = view.days[picked ?? view.low]
  const firstPayday = view.paydays.at(0)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left) / Math.max(1, box.width)
    onPick(Math.max(0, Math.min(AHEAD_DAYS, Math.round(ratio * AHEAD_DAYS))))
  }

  return (
    <div dir="ltr" className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-[11.5px] font-semibold text-fp-text-2">
        <span className="flex items-center gap-[5px]">
          <span aria-hidden className="h-[2px] w-3 bg-fp-text-2" />
          Balance
        </span>
        <span className="flex items-center gap-[5px]">
          <span aria-hidden className="h-[3px] w-3 rounded-full bg-fp-accent" />
          Free to spend
        </span>
      </div>
      <p
        className="fp-sensitive text-[12.5px] text-fp-text-2"
        aria-live="polite"
      >
        <span className="font-bold text-fp-text">{dayMonth(shown.date)}</span> ·
        Balance {signedMoney(shown.balance, base)} · Free{' '}
        <span
          className={
            shown.free < 0
              ? 'font-bold text-fp-danger'
              : 'font-bold text-fp-accent-ink'
          }
        >
          {signedMoney(shown.free, base)}
        </span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full touch-none"
        role="img"
        aria-label={view.note}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => onPick(null)}
      >
        {lo < 0 ? (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--fp-danger)"
            strokeOpacity={0.4}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {view.paydays.map((d) => (
          <line
            key={d}
            x1={x(d)}
            x2={x(d)}
            y1={PAD}
            y2={H - PAD}
            stroke="var(--fp-border-strong)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={line('balance')}
          fill="none"
          stroke="var(--fp-text-2)"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line('free')}
          fill="none"
          stroke="var(--fp-accent)"
          strokeWidth={2.4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(picked ?? view.low)}
          x2={x(picked ?? view.low)}
          y1={PAD}
          y2={H - PAD}
          stroke="var(--fp-text-3)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[11px] font-medium text-fp-text-3">
        <span>Today</span>
        {firstPayday !== undefined ? (
          <span>Payday · {dayMonth(view.days[firstPayday].date)}</span>
        ) : null}
        <span>{dayMonth(view.days[AHEAD_DAYS].date)}</span>
      </div>
      <p className="fp-sensitive border-t border-fp-border pt-2 text-[12.5px] text-fp-text-2">
        {view.note}
      </p>
    </div>
  )
}
