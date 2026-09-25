import { differenceLabel } from '#/features/balances/data/adjustBalance'
import type { AdjustPreview } from '#/features/balances/data/adjustBalance'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  preview: AdjustPreview
  currency: CurrencyCode
}

/** The gap between what the app has and what the user says, which is what gets recorded. */
export function AdjustDifferenceBox({ preview, currency }: Props) {
  return (
    <div
      aria-live="polite"
      className="mt-3 flex items-center gap-[10px] rounded-[13px] border border-fp-border bg-fp-surface-2 px-3 py-[10px]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-[0.05em] text-fp-text-3">
          DIFFERENCE
        </span>
        <span className="block text-[17px] font-extrabold text-fp-text tabular-nums">
          {differenceLabel(preview.difference, currency)}
        </span>
      </span>
      <span className="flex-none text-end text-[12px] text-fp-text-2">
        {preview.adjustment
          ? 'Recorded as a balance adjustment'
          : preview.hasTarget
            ? 'Matches the current balance'
            : 'Type what the wallet really holds'}
      </span>
    </div>
  )
}
