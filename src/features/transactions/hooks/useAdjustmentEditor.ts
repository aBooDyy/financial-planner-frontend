import { useState } from 'react'
import type { LocalTransaction } from '#/db/types'
import { isAdjustment } from '#/features/transactions/api/types'
import {
  deleteTransaction,
  updateAdjustment,
} from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

export type AdjustmentDirection = 'in' | 'out'

export type AdjustmentEditorState = {
  id: string
  walletId: string
  currency: CurrencyCode
  direction: AdjustmentDirection
  amount: string
  date: string
  note: string
}

type Field = 'direction' | 'amount' | 'date' | 'note'

/** Edit or delete one balance adjustment from the activity list. Its wallet stays put. */
export function useAdjustmentEditor() {
  const [editing, setEditing] = useState<AdjustmentEditorState | null>(null)

  const openEdit = (t: LocalTransaction) => {
    if (!isAdjustment(t.type)) return
    setEditing({
      id: t.id,
      walletId: t.walletId,
      currency: t.currency,
      direction: t.type === 'adjustment_in' ? 'in' : 'out',
      amount: minorToInputValue(t.amount, t.currency),
      date: t.date,
      note: t.note ?? '',
    })
  }

  const close = () => setEditing(null)

  const setField = <TKey extends Field>(
    field: TKey,
    value: AdjustmentEditorState[TKey],
  ) => setEditing((prev) => (prev ? { ...prev, [field]: value } : prev))

  const amountMinor = editing
    ? parseAmountToMinor(editing.amount, editing.currency)
    : null
  const canSave = amountMinor !== null && amountMinor > 0 && !!editing?.date

  const save = async () => {
    if (!editing || !canSave) return
    await updateAdjustment(editing.id, {
      type: editing.direction === 'in' ? 'adjustment_in' : 'adjustment_out',
      amount: amountMinor,
      currency: editing.currency,
      walletId: editing.walletId,
      date: editing.date,
      note: editing.note.trim() || null,
    })
    close()
  }

  const remove = async () => {
    if (!editing) return
    await deleteTransaction(editing.id)
    close()
  }

  return { editing, openEdit, close, setField, canSave, save, remove }
}

export type AdjustmentEditor = ReturnType<typeof useAdjustmentEditor>
