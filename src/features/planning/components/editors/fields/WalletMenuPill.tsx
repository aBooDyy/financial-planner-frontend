import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import { TxAccountPill } from '#/features/transactions/components/TxAccountPill'
import { useAccountSections } from '#/features/transactions/hooks/useAccountSections'

type Props = {
  /** "Paid from", "Paid into". */
  lead: string
  wallets: ReadonlyArray<PlanningWallet>
  value: string | null
  onChange: (walletId: string | null) => void
  /** Offers no wallet ("Decide when paying"). */
  noneLabel?: string
}

/** A pill under an amount naming its wallet ("Paid from Main bank ▾"); opens the account tree. */
export function WalletMenuPill({
  lead,
  wallets,
  value,
  onChange,
  noneLabel,
}: Props) {
  const { sections, amountsLoading, accountById } = useAccountSections(wallets)
  const picked = value ? accountById(value) : undefined
  return (
    <TxAccountPill
      label={lead}
      sections={sections}
      chosen={picked ?? null}
      archived={picked?.archived ?? false}
      onChange={(walletId) => onChange(walletId || null)}
      invalid={false}
      amountsLoading={amountsLoading}
      noneLabel={noneLabel}
    />
  )
}
