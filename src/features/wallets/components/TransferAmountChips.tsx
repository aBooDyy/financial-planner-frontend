import { Chip, ChipRow } from '#/components/dialog/Chip'
import type { AmountChip } from '#/features/wallets/data/transferDialog'

type Props = {
  chips: AmountChip[]
  onPick: (minor: number) => void
}

/** 25% · 50% · All of the source balance. */
export function TransferAmountChips({ chips, onPick }: Props) {
  return (
    <ChipRow label="Quick amounts">
      {chips.map((c) => (
        <Chip
          key={c.key}
          active={c.active}
          color="var(--fp-transfer)"
          disabled={c.disabled}
          onClick={() => onPick(c.minor)}
        >
          <span className="tabular-nums">{c.label}</span>
        </Chip>
      ))}
    </ChipRow>
  )
}
