import { useNavigate } from '@tanstack/react-router'
import type { LocalTransaction } from '#/db/types'
import { readTransferLegs } from '#/features/transactions/data/ledgerReads'
import type { ActivityRow } from '#/features/transactions/data/selectors'
import type { AdjustmentEditor } from '#/features/transactions/hooks/useAdjustmentEditor'
import type { TxEditorApi } from '#/features/transactions/hooks/useTxEditor'

/**
 * Opens the right editor for an Activity row. `rows` are the ledger rows the list was built
 * from; a transfer's legs are read on their own, since a leg can fall outside that window.
 */
export function useActivityRowClick(
  editor: TxEditorApi,
  adjustment: AdjustmentEditor,
  rows: ReadonlyArray<LocalTransaction>,
) {
  const navigate = useNavigate()

  return (row: ActivityRow) => {
    if (row.kind === 'set_aside') {
      void navigate({ to: '/goals' })
      return
    }
    if (row.kind === 'transfer') {
      void readTransferLegs(row.id).then((legs) =>
        editor.openEditTransfer(row.id, legs),
      )
      return
    }
    const t = rows.find((x) => x.id === row.id && x.deleted === 0)
    if (!t) return
    if (row.kind === 'adjustment') adjustment.openEdit(t)
    else editor.openEditTx(t)
  }
}
