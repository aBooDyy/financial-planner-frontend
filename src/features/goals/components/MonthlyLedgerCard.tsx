import type { CSSProperties } from 'react'
import type { LedgerNet, LedgerRow } from '#/features/goals/data/selectors'
import { SURFACE_CARD } from './styles'

type Props = {
  rows: LedgerRow[]
  net: LedgerNet
  usageStr: string
}

// Below this the amount no longer fits inside its own bar, so it sits after it instead.
const INSIDE_MIN_PCT = 26

type BarProps = {
  pct: number
  valueStr: string
  fill: CSSProperties
  insideClass: string
  outsideClass: string
}

/**
 * One measured bar. The track is what the percentage resolves against — never the whole row —
 * so the label column can't push a full-width bar past the card edge.
 */
function LedgerBar({
  pct,
  valueStr,
  fill,
  insideClass,
  outsideClass,
}: BarProps) {
  const inside = pct >= INSIDE_MIN_PCT
  return (
    <span className="flex min-w-0 flex-1 items-center">
      {pct >= 1 ? (
        <span
          className="flex h-[26px] max-w-full flex-none items-center overflow-hidden rounded-[7px] px-[10px]"
          style={{ ...fill, width: `${Math.min(100, Math.max(2, pct))}%` }}
        >
          {inside ? (
            <span
              className={`fp-sensitive truncate tabular-nums ${insideClass}`}
            >
              {valueStr}
            </span>
          ) : null}
        </span>
      ) : null}
      {inside ? null : (
        <span
          className={`fp-sensitive truncate tabular-nums ${outsideClass} ${pct >= 1 ? 'ms-[10px]' : ''}`}
        >
          {valueStr}
        </span>
      )}
    </span>
  )
}

/**
 * What the month looks like in one picture: income, then the two things it has to cover, then
 * what survives. Every bar shares one denominator so the widths are comparable.
 */
export function MonthlyLedgerCard({ rows, net, usageStr }: Props) {
  return (
    <div className={`px-[18px] py-[17px] ${SURFACE_CARD}`}>
      <div className="flex items-center justify-between gap-[10px]">
        <span className="text-[11px] font-bold tracking-[0.05em] text-fp-text-3 uppercase">
          Every month
        </span>
        <span className="text-[11.5px] whitespace-nowrap text-fp-text-3">
          {usageStr}
        </span>
      </div>

      <div className="mt-[14px] flex flex-col gap-[3px]">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-3">
            <span className="w-[72px] flex-none text-[12.5px] font-semibold text-fp-text-2 md:w-[96px]">
              {row.label}
            </span>
            <LedgerBar
              pct={row.pct}
              valueStr={row.valueStr}
              fill={{ background: row.color }}
              insideClass="text-[12.5px] font-bold text-white"
              outsideClass="text-[12.5px] font-bold text-fp-text-3"
            />
          </div>
        ))}

        <div className="my-2 ms-[84px] h-px bg-fp-border md:ms-[108px]" />

        <div className="flex items-center gap-3">
          <span className="w-[72px] flex-none text-[12.5px] font-bold text-fp-accent md:w-[96px]">
            {net.label}
          </span>
          <LedgerBar
            pct={net.pct}
            valueStr={net.valueStr}
            fill={{
              background: 'var(--fp-accent-soft)',
              border: '1px solid var(--fp-accent)',
            }}
            insideClass="text-[12.5px] font-extrabold text-fp-accent"
            outsideClass="text-[12.5px] font-extrabold text-fp-accent"
          />
        </div>
      </div>
    </div>
  )
}
