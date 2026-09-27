import { useId } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { ForecastView } from '#/features/planned/data/forecast'
import { useDirectionStore } from '#/stores/direction'

type Props = {
  view: ForecastView
  /** The day the readout shows. */
  shownIndex: number
  /** The day under the pointer or keyboard; `null` puts the readout back on the lowest day. */
  pickedIndex: number | null
  onPick: (index: number | null) => void
}

const HEIGHT = 96

/** Balance holds through a day and changes at the next, so the line steps. */
function stepPath(ys: number[], x: (i: number) => number): string {
  return ys.map((y, i) => (i === 0 ? `M0 ${y}` : `H${x(i)} V${y}`)).join(' ')
}

const clamp = (v: number) => Math.min(100, Math.max(0, v))

const zoneOf = (balance: number, reserved: number): string =>
  balance < 0
    ? 'var(--fp-danger)'
    : reserved > 0 && balance < reserved
      ? 'var(--fp-warn)'
      : 'var(--fp-accent)'

/**
 * The step line of the balance ahead, coloured by zone: accent above goal money, warn inside
 * it, danger below zero. Drawn in a stretched 100×100 box; the dots and reference lines sit
 * over it in HTML so they keep their shape. Scrubbed by pointer or arrow keys.
 */
export function ForecastChart({
  view,
  shownIndex,
  pickedIndex,
  onPick,
}: Props) {
  const id = useId()
  const rtl = useDirectionStore((s) => s.direction) === 'rtl'
  const { days, lo, hi, reserved } = view
  const last = days.length - 1
  const x = (i: number) => (i / last) * 100
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100
  const path = stepPath(
    days.map((d) => y(d.balance)),
    x,
  )
  const zeroY = clamp(y(0))
  const reservedY = reserved > 0 ? clamp(y(reserved)) : zeroY
  const zones = [
    { key: 'clear', top: 0, bottom: reservedY, color: 'var(--fp-accent)' },
    { key: 'reserved', top: reservedY, bottom: zeroY, color: 'var(--fp-warn)' },
    { key: 'short', top: zeroY, bottom: 100, color: 'var(--fp-danger)' },
  ].filter((z) => z.bottom > z.top)

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const from = rtl ? box.right - e.clientX : e.clientX - box.left
    return Math.round(clamp((from / box.width) * 100) / (100 / last))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    const step: Record<string, number> = {
      [forward]: shownIndex + 1,
      [back]: shownIndex - 1,
      Home: 0,
      End: last,
    }
    if (e.key === 'Escape') onPick(null)
    else if (e.key in step) onPick(Math.min(last, Math.max(0, step[e.key])))
    else return
    e.preventDefault()
  }

  const shown = days[shownIndex]
  const low = days[view.lowIndex]
  const dot = (i: number, balance: number) => ({
    insetInlineStart: `${x(i)}%`,
    top: `${y(balance)}%`,
    background: zoneOf(balance, reserved),
  })

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={view.ariaLabel}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={shownIndex}
      aria-valuetext={`${shown.dateStr}: ${shown.balanceStr}`}
      className="relative cursor-crosshair touch-pan-y rounded-[6px] border-y border-fp-border outline-none focus-visible:ring-2 focus-visible:ring-fp-accent"
      style={{ height: HEIGHT }}
      onPointerDown={(e) => onPick(indexAt(e))}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || e.buttons > 0) onPick(indexAt(e))
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') onPick(null)
      }}
      onKeyDown={onKeyDown}
    >
      {reserved > 0 && reservedY > 0 && reservedY < 100 ? (
        <ReferenceLine top={reservedY} label="Goal money" tone="warn" />
      ) : null}
      {view.status.kind === 'short' ? (
        <ReferenceLine top={zeroY} label="Zero" tone="danger" />
      ) : null}

      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible rtl:-scale-x-100"
      >
        <defs>
          {zones.map((z) => (
            <clipPath key={z.key} id={`${id}-${z.key}`}>
              <rect x={-1} y={z.top} width={102} height={z.bottom - z.top} />
            </clipPath>
          ))}
        </defs>
        {zones.map((z) => (
          <path
            key={z.key}
            d={path}
            fill="none"
            stroke={z.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            clipPath={`url(#${id}-${z.key})`}
          />
        ))}
      </svg>

      {pickedIndex !== null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-fp-border-strong rtl:translate-x-1/2"
          style={{ insetInlineStart: `${x(pickedIndex)}%` }}
        />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-fp-surface rtl:translate-x-1/2"
        style={dot(shownIndex, shown.balance)}
      />
      {pickedIndex !== null && pickedIndex !== view.lowIndex ? (
        <span
          aria-hidden
          className="pointer-events-none absolute size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 ring-2 ring-fp-surface rtl:translate-x-1/2"
          style={dot(view.lowIndex, low.balance)}
        />
      ) : null}
    </div>
  )
}

function ReferenceLine({
  top,
  label,
  tone,
}: {
  top: number
  label: string
  tone: 'warn' | 'danger'
}) {
  return (
    <div
      aria-hidden
      className={
        tone === 'warn'
          ? 'pointer-events-none absolute inset-x-0 border-t border-fp-warn/40'
          : 'pointer-events-none absolute inset-x-0 border-t border-fp-danger/40'
      }
      style={{ top: `${top}%` }}
    >
      <span className="absolute start-0 bottom-[2px] text-[10px] leading-none font-semibold text-fp-text-3">
        {label}
      </span>
    </div>
  )
}
