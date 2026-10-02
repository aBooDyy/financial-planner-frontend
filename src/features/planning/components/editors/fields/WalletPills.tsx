import { Chip, ChipRow } from '#/components/dialog/Chip'
import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import { Dot } from '#/features/planning/components/kit/Spine'

type Props = {
  label: string
  wallets: ReadonlyArray<PlanningWallet>
  value: string | null
  onChange: (walletId: string) => void
}

/** One chip per wallet ("Save in"). */
export function WalletPills({ label, wallets, value, onChange }: Props) {
  return (
    <ChipRow label={label}>
      {wallets.map((w) => (
        <Chip
          key={w.id}
          size="sm"
          active={w.id === value}
          onClick={() => onChange(w.id)}
        >
          <Dot color={w.color} />
          {w.name}
        </Chip>
      ))}
    </ChipRow>
  )
}
