import { useEffect, useRef } from 'react'
import { db } from '#/db/db'
import { ConnectedTxEditor } from '#/features/transactions/components/ConnectedTxEditor'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { useTxEditor } from '#/features/transactions/hooks/useTxEditor'

type Props = { transactionId: string; onClose: () => void }

/** A bill's payment or a goal's spend, opened in the transaction editor over Planning. */
export function PaymentEditorSheet({ transactionId, onClose }: Props) {
  const {
    loading,
    base,
    inputs,
    deltas,
    editorWallets,
    archivedWalletIds,
    goals,
  } = useTransactions()
  const editor = useTxEditor(
    editorWallets,
    base,
    inputs.rates,
    archivedWalletIds,
  )
  const opened = useRef(false)

  useEffect(() => {
    if (loading || opened.current) return
    void db.transactions.get(transactionId).then((t) => {
      if (!t || t.deleted !== 0) {
        onClose()
        return
      }
      opened.current = true
      editor.openEditTx(t)
    })
    // Opens once, as soon as the wallets the editor offers have loaded.
  }, [loading, transactionId])

  useEffect(() => {
    if (opened.current && !editor.editing) onClose()
  }, [editor.editing, onClose])

  return deltas ? (
    <ConnectedTxEditor
      editor={editor}
      wallets={editorWallets}
      archivedWalletIds={archivedWalletIds}
      goals={goals}
      base={base}
      data={inputs}
      deltas={deltas}
    />
  ) : null
}
