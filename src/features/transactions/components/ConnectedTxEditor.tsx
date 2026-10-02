import { useNavigate } from '@tanstack/react-router'
import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import { transferWallets } from '#/features/wallets/data/transferDialog'
import { scopeSections } from '#/features/transactions/data/selectors'
import type { SpendingInputs } from '#/features/transactions/data/selectors'
import type { TxEditorApi } from '#/features/transactions/hooks/useTxEditor'
import type { CurrencyCode } from '#/lib/currency'
import { BudgetEditor } from './BudgetEditor'
import { TransactionDialog } from './TransactionDialog'

type Props = {
  editor: TxEditorApi
  wallets: LocalBalanceNode[]
  archivedWalletIds: ReadonlySet<string>
  goals: LocalGoal[]
  base: CurrencyCode
  data: SpendingInputs
  /** Each wallet's signed delta over the whole ledger, in its own currency. */
  deltas: Record<string, number>
}

/**
 * A `useTxEditor` instance wired to its editor — the transaction dialog or the budget editor.
 * Renders nothing while nothing is being edited.
 */
export function ConnectedTxEditor({
  editor,
  wallets,
  archivedWalletIds,
  goals,
  base,
  data,
  deltas,
}: Props) {
  const navigate = useNavigate()
  const { rates } = data

  const { editing } = editor
  if (!editing) return null
  if (editing.kind === 'budget') {
    return (
      <BudgetEditor
        editing={editing}
        wallets={wallets}
        archivedWalletIds={archivedWalletIds}
        onField={editor.setField}
        onScopeType={editor.setScopeType}
        onSave={() => void editor.save()}
        onDelete={() => void editor.remove()}
        onClose={editor.close}
      />
    )
  }

  const accounts = transferWallets(wallets, deltas, base)
  const accountSections = scopeSections(data, deltas)
  return (
    <TransactionDialog
      editing={editing}
      accounts={accounts}
      accountSections={accountSections}
      archivedIds={archivedWalletIds}
      goals={goals}
      rates={rates}
      base={base}
      onField={editor.setField}
      onType={editor.setType}
      onSwapTransfer={editor.swapTransferWallets}
      onResetReceived={editor.resetReceived}
      onCategory={editor.setCategory}
      onSpendTarget={editor.setSpendTarget}
      onMerchant={editor.setMerchant}
      onApplySuggestion={editor.applySuggestion}
      onSave={(link) => void editor.save(link)}
      onDelete={() => void editor.remove()}
      onClose={editor.close}
      onAddWallet={() => {
        editor.close()
        void navigate({ to: '/wallets' })
      }}
    />
  )
}
