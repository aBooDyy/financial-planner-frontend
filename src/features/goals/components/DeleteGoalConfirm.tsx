import { useState } from 'react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import type { EditorType } from '#/features/goals/hooks/useGoalEditor'
import { messageForApiError } from '#/lib/errorMessages'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: EditorType
  name: string
  onConfirm: () => Promise<void>
}

const BULLETS: Record<EditorType, ReadonlyArray<string>> = {
  goal: [
    'Its open planned items leave the plan.',
    'Money set aside for it is no longer reserved.',
    'Payments already recorded stay in Spending.',
  ],
  income: [
    'Its planned paydays leave the plan.',
    'Income already recorded stays in Spending.',
  ],
}

/** "Delete Rent?" with what goes and what stays. */
export function DeleteGoalConfirm({
  open,
  onOpenChange,
  type,
  name,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(messageForApiError(e))
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete “${name}”?`}
      bullets={BULLETS[type]}
      error={error}
      confirmLabel="Delete"
      onConfirm={() => void confirm()}
      busy={busy}
    />
  )
}
