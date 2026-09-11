import { useEffect, useState } from 'react'
import { Input } from '#/components/ui/input'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  code: CurrencyCode
  base: CurrencyCode
  /** Display value: how many `base` units per 1 `code`. */
  display: number
  onCommit: (display: number) => void
  last?: boolean
}

const fmt = (n: number): string =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })

/** One editable FX row: "1 USD = [3.75] SAR". Commits on blur / Enter when valid + changed. */
export function RateRow({ code, base, display, onCommit, last }: Props) {
  const [text, setText] = useState(fmt(display))

  // Keep the field in sync when the underlying rate changes from elsewhere (sync/base switch),
  // unless the user is mid-edit (handled by re-seeding only on display change).
  useEffect(() => {
    setText(fmt(display))
  }, [display])

  const commit = () => {
    const parsed = Number(text.replace(/[\s,]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== display) {
      onCommit(parsed)
    } else {
      setText(fmt(display))
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-[18px] py-[13px] ${
        last ? '' : 'border-b border-fp-border'
      }`}
    >
      <div className="flex h-[30px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-fp-border bg-fp-surface-2 text-[12px] font-bold">
        {code}
      </div>
      <span className="whitespace-nowrap text-[13.5px] text-fp-text-2">
        1 {code} =
      </span>
      <div className="flex-1" />
      <Input
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-[104px] rounded-[10px] border-fp-border-strong px-[11px] py-[9px] text-end text-[14px] tabular-nums focus:shadow-[0_0_0_3px_var(--fp-accent-soft)]"
      />
      <span className="w-[38px] text-[13.5px] font-semibold text-fp-text-3">
        {base}
      </span>
    </div>
  )
}
