import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { differenceLabel } from '#/features/wallets/data/adjustBalance'
import type { AdjustPreview } from '#/features/wallets/data/adjustBalance'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  preview: AdjustPreview
  currency: CurrencyCode
}

const help = (preview: AdjustPreview) =>
  preview.adjustment
    ? 'Recorded as a balance adjustment'
    : preview.hasTarget
      ? 'Matches the current balance'
      : 'Type what the wallet really holds'

/** The gap between what the app has and what the user says, which is what gets recorded. */
export function AdjustDifferenceBox({ preview, currency }: Props) {
  const { difference } = preview
  return (
    <div className="flex min-w-0 flex-col">
      <FieldLabel>Difference</FieldLabel>
      <div
        aria-live="polite"
        className={cn(
          'truncate rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface px-[14px] py-3 text-[14px] font-extrabold tabular-nums',
          difference > 0
            ? 'text-fp-accent-ink'
            : difference < 0
              ? 'text-fp-danger'
              : 'text-fp-text-3',
        )}
      >
        {differenceLabel(difference, currency)}
      </div>
      <FieldMessage help={help(preview)} />
    </div>
  )
}
