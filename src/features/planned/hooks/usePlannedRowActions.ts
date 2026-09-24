import { useState } from 'react'
import { confirmPlanned, skipPlanned } from '#/features/planned/data/mutations'
import type { PlannedRowView } from '#/features/planned/data/views'

/**
 * A Planned-tab row's buttons. Confirm is one tap when the row knows its wallet and nothing is
 * settled yet; otherwise — or when the one-tap write is refused — it opens the confirm dialog,
 * which asks for what is missing and shows why.
 */
export function usePlannedRowActions(openDialog: (id: string) => void) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const attempt = async (
    row: PlannedRowView,
    action: () => Promise<unknown>,
  ) => {
    setBusyId(row.id)
    try {
      await action()
    } catch {
      openDialog(row.id)
    } finally {
      setBusyId(null)
    }
  }

  return {
    busyId,
    confirm: (row: PlannedRowView) =>
      row.oneTap
        ? attempt(row, () => confirmPlanned(row.id))
        : openDialog(row.id),
    skip: (row: PlannedRowView) => attempt(row, () => skipPlanned(row.id)),
  }
}
