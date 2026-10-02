import { useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import type { GoalSpendPart } from '#/features/planning/actions/goalMoney'
import type { HeldLine } from '#/features/planning/data/status'
import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import { money } from '#/features/planning/view/format'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { WalletPills } from '#/features/planning/components/editors/fields/WalletPills'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { SplitRows } from './SplitRows'
import type { SplitRow } from './SplitRows'

/**
 * "I spent it": which wallets paid and how much each (D30, 03 §5). One wallet by default,
 * its amount what that wallet holds for the goal; or a split, one row per wallet holding some.
 * Each wallet's spend releases only its own set-asides, so every Balance still matches its
 * bank; what is left (other wallets, money held outside) is freed by the close.
 */
export function useSpentFrom(args: {
  heldIn: ReadonlyArray<HeldLine>
  held: number
  currency: CurrencyCode
  defaultWalletId: string
}) {
  const { heldIn, held, currency } = args
  const heldBy = (walletId: string) =>
    heldIn.find((h) => h.walletId === walletId)?.amount ?? 0
  const [walletId, setWalletId] = useState(args.defaultWalletId)
  const [typed, setTyped] = useState<string | null>(null)
  const [split, setSplit] = useState(false)
  const [rows, setRows] = useState<SplitRow[]>([])

  const amountText = typed ?? minorToInputValue(heldBy(walletId), currency)
  const parts: GoalSpendPart[] = split
    ? rows
        .map((r) => ({
          walletId: r.walletId,
          amount: parseAmountToMinor(r.amount, currency) ?? 0,
        }))
        .filter((p) => p.walletId && p.amount > 0)
    : walletId
      ? [{ walletId, amount: parseAmountToMinor(amountText, currency) ?? 0 }]
      : []

  const spentByWallet = new Map<string, number>()
  for (const p of parts)
    spentByWallet.set(
      p.walletId,
      (spentByWallet.get(p.walletId) ?? 0) + p.amount,
    )
  const released = [...spentByWallet].reduce(
    (sum, [id, amount]) => sum + Math.min(amount, heldBy(id)),
    0,
  )

  const block =
    !split && !walletId
      ? 'Pick the wallet it was paid from'
      : !split && (parts[0]?.amount ?? 0) <= 0
        ? 'Enter how much you spent'
        : split && parts.length === 0
          ? 'Pick a wallet'
          : null

  return {
    walletId,
    pickWallet: (id: string) => {
      setWalletId(id)
      setTyped(null)
    },
    amountText,
    setAmount: setTyped,
    split,
    setSplit: (on: boolean) => {
      if (on && rows.length === 0) setRows(rowsFrom(heldIn, walletId, currency))
      setSplit(on)
    },
    rows,
    setRows,
    parts,
    freed: Math.max(0, held - released),
    block,
  }
}

/** One row per wallet holding money for the goal, else one for the picked wallet. */
function rowsFrom(
  heldIn: ReadonlyArray<HeldLine>,
  walletId: string,
  currency: CurrencyCode,
): SplitRow[] {
  const lines = heldIn.filter(
    (h): h is HeldLine & { walletId: string } => h.walletId !== null,
  )
  if (lines.length === 0) return [{ key: 1, walletId, amount: '' }]
  return lines.map((h, i) => ({
    key: i + 1,
    walletId: h.walletId,
    amount: minorToInputValue(h.amount, currency),
  }))
}

type Props = {
  state: ReturnType<typeof useSpentFrom>
  wallets: ReadonlyArray<PlanningWallet>
  currency: CurrencyCode
}

export function SpentFrom({ state, wallets, currency }: Props) {
  return (
    <>
      {state.split ? (
        <SplitRows
          label="Paid from"
          rows={state.rows}
          setRows={state.setRows}
          currency={currency}
          wallets={wallets}
        />
      ) : (
        <>
          <div>
            <FieldLabel>Paid from</FieldLabel>
            <WalletPills
              label="Paid from"
              wallets={wallets}
              value={state.walletId}
              onChange={state.pickWallet}
            />
          </div>
          <AmountWell
            question="How much did you spend?"
            currency={currency}
            amount={state.amountText}
            onAmount={state.setAmount}
            tone="spend"
          />
        </>
      )}
      <ToggleCard
        title="Paid from several wallets"
        description="Record what each wallet paid."
        checked={state.split}
        onCheckedChange={state.setSplit}
      />
      {state.freed > 0 ? (
        <InfoLine>
          The other {money(state.freed, currency)} set aside is freed.
        </InfoLine>
      ) : null}
    </>
  )
}
