import { useState } from 'react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { deleteBill } from '#/features/bills/data/mutations'
import { deleteGoal, deleteIncome } from '#/features/goals/data/mutations'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { toast } from '#/features/planning/stores/toast'

type Target = { kind: 'bill' | 'goal' | 'income'; id: string }

type Props = {
  target: Target
  onClose: () => void
  /** After the delete, e.g. to close the item's detail panel. */
  onDeleted: () => void
}

const BULLETS: Record<Target['kind'], string[]> = {
  bill: [
    'Money set aside for it is freed in its wallets.',
    'Payments you already made stay in Spending.',
    'It stops showing in Upcoming.',
  ],
  goal: [
    'Money set aside for it is freed in its wallets.',
    'Spending from it stays in Spending.',
  ],
  income: [
    'Its paydays stop being planned.',
    'Pay you already received stays in Spending.',
  ],
}

/** "Delete Rent?" for a bill, goal or income stream. */
export function DeleteItemConfirm({ target, onClose, onDeleted }: Props) {
  const { inputs } = usePlannedData()
  const [busy, setBusy] = useState(false)
  const name =
    target.kind === 'bill'
      ? inputs.bills.find((b) => b.id === target.id)?.name
      : target.kind === 'goal'
        ? inputs.goals.find((g) => g.id === target.id)?.name
        : inputs.income.find((s) => s.id === target.id)?.label

  const confirm = async () => {
    setBusy(true)
    try {
      if (target.kind === 'bill') await deleteBill(target.id)
      else if (target.kind === 'goal') await deleteGoal(target.id)
      else await deleteIncome(target.id)
      toast(`${name ?? 'It'} deleted`)
      onDeleted()
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Delete ${name ?? 'this'}?`}
      bullets={BULLETS[target.kind]}
      confirmLabel="Delete"
      busy={busy}
      onConfirm={() => void confirm()}
    />
  )
}
