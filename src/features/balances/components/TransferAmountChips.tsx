import type { AmountChip } from '#/features/balances/data/transferDialog'
import { cn } from '#/lib/utils'

type Props = {
  chips: AmountChip[]
  onPick: (minor: number) => void
}

/** 25% · 50% · All of the source balance. */
export function TransferAmountChips({ chips, onPick }: Props) {
  return (
    <div className="mt-[10px] flex flex-wrap gap-[6px]">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          disabled={c.disabled}
          aria-pressed={c.active}
          onClick={() => onPick(c.minor)}
          className={cn(
            'cursor-pointer rounded-full border px-[11px] py-[6px] text-[12px] whitespace-nowrap tabular-nums transition disabled:cursor-not-allowed disabled:opacity-50',
            c.active
              ? 'border-fp-accent bg-fp-accent-soft font-bold text-fp-accent-ink'
              : 'border-fp-border bg-fp-surface-2 font-semibold text-fp-text-2',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
