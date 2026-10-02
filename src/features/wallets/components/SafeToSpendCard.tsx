import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SegmentedBar } from '#/components/SegmentedBar'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Skeleton } from '#/components/ui/skeleton'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'
import type {
  SafeHeaderLine,
  SafeHeaderView,
  SafeLineLink,
} from '#/features/wallets/data/safeHeader'
import type { WalletsView } from '#/features/wallets/data/selectors'

type Props = {
  /** The tree's counts and group bars. */
  view: WalletsView
  /** Null while any figure it derives from is loading. */
  header: SafeHeaderView | null
  /** The tree's figures are still loading. */
  loading: boolean
  base: CurrencyCode
  onLink: (to: SafeLineLink) => void
}

/**
 * The Wallets headline (03 §8, D13): Safe to spend for the window, and the sum it comes from —
 * always visible on desktop, a tap away on mobile — then the budgets caption, the counts and
 * the group bar.
 */
export function SafeToSpendCard({
  view,
  header,
  loading,
  base,
  onLink,
}: Props) {
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const showSum = desktop || open

  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-5 shadow-fp md:p-7">
      <div className="mb-[10px] text-[12px] font-bold tracking-[0.04em] text-fp-text-2 uppercase">
        Safe to spend
      </div>

      <div className="flex flex-wrap items-end gap-[10px]">
        <span
          className={cn(
            'fp-sensitive text-[38px] leading-[1.05] font-extrabold tracking-[-0.02em] tabular-nums whitespace-nowrap',
            header?.negative && 'text-fp-danger',
          )}
        >
          <ValueOrSkeleton value={header?.safeStr} className="h-[38px] w-48" />
        </span>
        <span className="mb-[5px] rounded-full border border-fp-border px-[9px] py-1 text-[12px] font-bold text-fp-text-3">
          {base}
        </span>
      </div>

      <div className="mt-[7px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <ValueOrSkeleton
          value={
            header ? (
              <span className="text-fp-text-2">{header.windowStr}</span>
            ) : null
          }
          className="h-3.5 w-36"
        />
        {header?.shortStr ? (
          <span className="fp-sensitive font-bold text-fp-danger">
            {header.shortStr}
          </span>
        ) : null}
        {!desktop ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="ms-auto flex items-center gap-1 text-[12.5px] font-bold text-fp-accent-ink"
          >
            {open ? 'Hide the sum' : 'How it adds up'}
            <ChevronDown
              size={14}
              aria-hidden
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        ) : null}
      </div>

      {showSum ? <SafeSum header={header} onLink={onLink} /> : null}

      {header?.budgetsStr ? (
        <div className="fp-sensitive mt-[10px] text-[12.5px] text-fp-text-3">
          {header.budgetsStr}
        </div>
      ) : null}

      <div className="mt-[14px] text-[13px] text-fp-text-2">
        {view.walletCountStr} · {view.groupCountStr} · {view.currencyCountStr}
      </div>

      {loading ? (
        <Skeleton aria-hidden className="mt-[14px] h-3 rounded-[7px]" />
      ) : (
        <SegmentedBar
          segments={view.groupBars.map((bar) => ({ ...bar, key: bar.id }))}
          className="mt-[14px] h-3 rounded-[7px]"
          minWidth="1%"
        />
      )}

      <div className="mt-[13px] flex flex-wrap gap-x-4 gap-y-[6px]">
        {view.groupBars.map((bar) => (
          <div key={bar.id} className="flex items-center gap-[7px]">
            <div
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: bar.color }}
            />
            <span className="text-[12.5px] font-semibold">{bar.label}</span>
            <span className="fp-sensitive text-[12px] text-fp-text-3 tabular-nums">
              <ValueOrSkeleton
                value={loading ? null : bar.valueStr}
                className="h-3 w-14"
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Balance − Set aside − Bills … = Safe to spend; linked lines open what they count. */
function SafeSum({
  header,
  onLink,
}: {
  header: SafeHeaderView | null
  onLink: (to: SafeLineLink) => void
}) {
  return (
    <div className="mt-[14px] rounded-[14px] bg-fp-surface-2 px-[14px] py-[6px]">
      <ul aria-label="How Safe to spend adds up">
        {header
          ? header.lines.map((line) => (
              <SumLine key={line.key} line={line} onLink={onLink} />
            ))
          : [0, 1, 2].map((i) => (
              <li key={i} className="py-[7px]">
                <Skeleton aria-hidden className="h-3.5 w-full" />
              </li>
            ))}
      </ul>
      <div className="flex items-baseline gap-2 border-t border-fp-border-strong py-[8px] text-[13.5px] font-extrabold">
        <span className="w-3 text-fp-text-3">=</span>
        <span className="flex-1">Safe to spend</span>
        <span
          className={cn(
            'fp-sensitive tabular-nums whitespace-nowrap',
            header?.negative && 'text-fp-danger',
          )}
        >
          <ValueOrSkeleton value={header?.safeStr} className="h-3.5 w-20" />
        </span>
      </div>
    </div>
  )
}

function SumLine({
  line,
  onLink,
}: {
  line: SafeHeaderLine
  onLink: (to: SafeLineLink) => void
}) {
  const label = (
    <span className="min-w-0 flex-1">
      <span className="font-semibold text-fp-text">{line.label}</span>
      {line.hint ? (
        <span className="ms-[6px] text-[12px] text-fp-text-3">{line.hint}</span>
      ) : null}
    </span>
  )
  const amount = (
    <span className="fp-sensitive font-bold tabular-nums whitespace-nowrap">
      {line.amountStr}
    </span>
  )
  const op = <span className="w-3 flex-none text-fp-text-3">{line.op}</span>
  const link = line.link
  return (
    <li className="border-b border-fp-border text-[13px] last:border-b-0">
      {link ? (
        <button
          type="button"
          onClick={() => onLink(link)}
          className="flex w-full items-baseline gap-2 py-[7px] text-start hover:text-fp-accent-ink"
        >
          {op}
          {label}
          {amount}
          <ChevronRight
            size={13}
            aria-hidden
            className="flex-none self-center text-fp-text-3 rtl:-scale-x-100"
          />
        </button>
      ) : (
        <div className="flex items-baseline gap-2 py-[7px] pe-[21px]">
          {op}
          {label}
          {amount}
        </div>
      )}
    </li>
  )
}
