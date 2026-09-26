import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Input } from '#/components/ui/input'
import type { CurrencyRateRow } from '#/features/settings/hooks/useCurrencyRates'
import type { CurrencyCode } from '#/lib/currency'
import { numericInputProps } from '#/lib/numericInput'

/** Every row is this tall, which is what lets the list be windowed. */
export const RATE_ROW_HEIGHT = 58

type Props = {
  row: CurrencyRateRow
  base: CurrencyCode
  onCommit: (perBase: number) => void
  onReset: () => void
}

const fmt = (n: number | null): string =>
  n === null
    ? ''
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })

/**
 * One editable FX row: "1 USD = [3.75] SAR". Commits on blur / Enter when valid and changed;
 * an edited row says so and offers the published rate back.
 */
export function RateRow({ row, base, onCommit, onReset }: Props) {
  const { code, meta, perBase, defaultPerBase, edited, held } = row
  const [text, setText] = useState(fmt(perBase))

  // Re-seed when the underlying rate changes from elsewhere — a sync, a base switch, or a
  // refreshed snapshot. A field the user is mid-edit in keeps its text until then.
  useEffect(() => {
    setText(fmt(perBase))
  }, [perBase])

  const commit = () => {
    const parsed = Number(text.replace(/[\s,]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== perBase) {
      onCommit(parsed)
    } else {
      setText(fmt(perBase))
    }
  }

  return (
    <div
      style={{ height: RATE_ROW_HEIGHT }}
      className="flex items-center gap-3 border-b border-fp-border px-[18px] last:border-b-0"
    >
      <div className="flex h-[30px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-fp-border bg-fp-surface-2 text-[12px] font-bold">
        {code}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] text-fp-text-2">
          {meta.name}
        </span>
        <span className="flex items-center gap-1.5 truncate text-[11.5px] text-fp-text-3">
          <span>1 {code} =</span>
          {held ? (
            <span className="rounded-full bg-fp-surface-2 px-1.5 font-semibold">
              Held
            </span>
          ) : null}
          {edited ? (
            <span className="rounded-full bg-fp-surface-2 px-1.5 font-semibold">
              Edited
            </span>
          ) : null}
        </span>
      </div>
      <Input
        value={text}
        aria-label={`Rate for ${code}`}
        placeholder={defaultPerBase === null ? 'No rate' : fmt(defaultPerBase)}
        {...numericInputProps({}, setText)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-[104px] shrink-0 rounded-[10px] border-fp-border-strong px-[11px] py-[9px] text-end text-[14px] tabular-nums focus:shadow-[0_0_0_3px_var(--fp-accent-soft)]"
      />
      <span className="w-[36px] shrink-0 text-[13.5px] font-semibold text-fp-text-3">
        {base}
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!edited || defaultPerBase === null}
        title={
          defaultPerBase === null
            ? 'No published rate'
            : `Reset to ${fmt(defaultPerBase)} ${base}`
        }
        aria-label={`Reset ${code} to the published rate`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text disabled:pointer-events-none disabled:opacity-0"
      >
        <RotateCcw size={14} strokeWidth={2.2} />
      </button>
    </div>
  )
}
