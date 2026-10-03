import { useState } from 'react'
import { confirmPlanned, skipPlanned } from '#/features/planned/data/mutations'
import type { PlannedRowView } from '#/features/planned/data/views'

/**
 * A planned row's buttons. Confirm is one tap when the row knows its wallet and nothing is
 * settled yet; otherwise — or when the one-tap write is refused — it opens the confirm dialog,
 * which asks for what is missing and shows why. Each resolves true when its own write landed.
 */
export function usePlannedRowActions(openDialog: (id: string) => void) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const attempt = async (
    row: PlannedRowView,
    action: () => Promise<unknown>,
  ): Promise<boolean> => {
    setBusyId(row.id)
    try {
      await action()
      return true
    } catch {
      openDialog(row.id)
      return false
    } finally {
      setBusyId(null)
    }
  }

  return {
    busyId,
    confirm: async (row: PlannedRowView): Promise<boolean> => {
      if (row.oneTap) return attempt(row, () => confirmPlanned(row.id))
      openDialog(row.id)
      return false
    },
    skip: (row: PlannedRowView) => attempt(row, () => skipPlanned(row.id)),
  }
}
