import { ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Skeleton } from '#/components/ui/skeleton'
import type { CurrencyCode } from '#/lib/currency'
import { useElementWidth } from '#/features/planning/hooks/useElementWidth'
import type { PlanningSection } from '#/features/planning/sections'
import { money, signedMoney } from '#/features/planning/view/format'
import type { PaycheckBar } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'
import {
  CardHeader,
  PlanCard,
} from '#/features/planning/components/kit/PlanCard'

/** The bar's width before it is measured (a desktop card). */
const FALLBACK_WIDTH = 900

/** Whether a segment `px` wide fits its 11.5px extrabold value with some room either side. */
const fitsLabel = (px: number, label: string): boolean =>
  px >= label.length * 7.5 + 16

/** Legend rows drawn while the bar loads. */
const LOADING_LEGEND = 3

type Props = {
  /** `null` while the plan loads. */
  bar: PaycheckBar | null
  base: CurrencyCode
  onSection: (section: PlanningSection) => void
  /** Drawn under the legend, inside the card. */
  footer?: ReactNode
}

/**
 * Each paycheck (04 §5): what the next paycheck carries — bills, saving up for bills, goals —
 * and what is left for spending. When the plan outruns the pay, the bar scales to the plan, a
 * line marks where the pay ends and a hatch covers the rest.
 */
export function PaycheckCard({ bar, base, onSection, footer }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const width = useElementWidth(track, FALLBACK_WIDTH)
  return (
    <PlanCard>
      <CardHeader
        title="Each paycheck"
        note={
          <span className="fp-sensitive">
            <ValueOrSkeleton value={bar?.caption} className="h-3 w-32" />
          </span>
        }
      />
      <div className="px-[18px]">
        <div className="relative pt-5">
          {bar && bar.payAt !== null ? (
            <div
              className="absolute top-0 bottom-0 z-10 flex flex-col items-end"
              style={{ insetInlineEnd: `${100 - bar.payAt}%` }}
            >
              <span className="fp-sensitive text-[11px] font-extrabold whitespace-nowrap text-fp-danger">
                Your pay · {money(bar.income ?? 0, base)}
              </span>
              <span className="w-[2px] flex-1 bg-fp-danger-fill" />
            </div>
          ) : null}
          <div
            ref={track}
            className="relative flex h-[34px] gap-[2px] overflow-hidden rounded-[10px] bg-fp-surface-2"
          >
            {!bar ? (
              <Skeleton aria-hidden className="size-full rounded-none" />
            ) : null}
            {bar?.segments.map((s) => (
              <button
                key={s.key}
                type="button"
                title={`${s.label} · ${money(s.amount, base)}`}
                aria-label={`${s.label}: ${money(s.amount, base)}`}
                onClick={() => onSection(s.section)}
                className="fp-sensitive flex h-full min-w-[3px] items-center justify-center overflow-hidden text-[11.5px] font-extrabold whitespace-nowrap text-white transition-[filter] hover:brightness-110"
                style={{ width: `${s.pct}%`, background: s.color }}
              >
                {fitsLabel((s.pct / 100) * width, money(s.amount, base))
                  ? money(s.amount, base)
                  : null}
              </button>
            ))}
            {bar && bar.payAt !== null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 end-0 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--fp-danger-fill)_55%,transparent)_0_5px,color-mix(in_srgb,var(--fp-danger-fill)_25%,transparent)_5px_10px)]"
                style={{ insetInlineStart: `${bar.payAt}%` }}
              />
            ) : null}
          </div>
        </div>
      </div>
      {!bar ? (
        <ul aria-hidden className="mt-2 px-[14px] pb-2">
          {Array.from({ length: LOADING_LEGEND }, (_, i) => (
            <li
              key={i}
              className="flex h-10 items-center gap-[10px] border-t border-fp-border px-1 first:border-t-0"
            >
              <Skeleton className="size-[10px] flex-none rounded-[3px]" />
              <Skeleton className="h-3.5 w-28" />
              <span className="flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-2 px-[14px] pb-2">
          {bar.legend.map((s) => (
            <li
              key={s.key}
              className="border-t border-fp-border first:border-t-0"
            >
              <button
                type="button"
                onClick={() => onSection(s.section)}
                className="flex w-full items-center gap-[10px] px-1 py-[10px] text-start"
              >
                <span
                  aria-hidden
                  className="size-[10px] flex-none rounded-[3px]"
                  style={{ background: s.color }}
                />
                <span className="text-[13.5px] font-bold">{s.label}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-fp-text-3">
                  {s.note}
                </span>
                <span
                  className={cn(
                    'fp-sensitive text-[13.5px] font-extrabold tabular-nums',
                    s.amount < 0 && 'text-fp-danger',
                  )}
                >
                  {signedMoney(s.amount, base)}
                </span>
                <ChevronRight
                  size={15}
                  aria-hidden
                  className="flex-none text-fp-text-3 rtl:-scale-x-100"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </PlanCard>
  )
}
