import { useEffect, useRef } from 'react'
import { useQuickAddStore } from '#/features/transactions/stores/quickAdd'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { useTxEditor } from '#/features/transactions/hooks/useTxEditor'
import { ConnectedTxEditor } from './ConnectedTxEditor'

/** The app-wide "add transaction" editor, opened from any page through `useQuickAddStore`. */
export function QuickAddSheet() {
  const open = useQuickAddStore((s) => s.open)
  return open ? <QuickAddEditor /> : null
}

/**
 * Mounted per opening. The blank draft picks its default wallet when it is created, so it
 * waits for the local reads to land; once the editor closes (saved or dismissed) the sheet
 * hides itself.
 */
function QuickAddEditor() {
  const hide = useQuickAddStore((s) => s.hide)
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
  const started = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!started.current) {
      started.current = true
      editor.openAddTx()
    } else if (!editor.editing) {
      hide()
    }
  })

  if (!deltas) return null
  return (
    <ConnectedTxEditor
      editor={editor}
      wallets={editorWallets}
      archivedWalletIds={archivedWalletIds}
      goals={goals}
      base={base}
      data={inputs}
      deltas={deltas}
    />
  )
}
