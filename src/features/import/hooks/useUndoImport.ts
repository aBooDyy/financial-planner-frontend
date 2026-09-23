import { useCallback, useState } from 'react'
import { planUndo, undoImport } from '#/features/import/data/batches'
import type { UndoPlan } from '#/features/import/data/batches'

/**
 * Undo in two beats: read what would go (and what would stay) so the dialog can say it,
 * then do it. The plan is read fresh each time it opens — a row edited a minute ago has to
 * show up as edited.
 */
export function useUndoImport() {
  const [plan, setPlan] = useState<UndoPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const open = useCallback(async (batchId: string) => {
    setPlan(await planUndo(batchId))
  }, [])

  const close = useCallback(() => setPlan(null), [])

  const confirm = useCallback(async () => {
    if (plan === null) return
    setBusy(true)
    try {
      await undoImport(plan.batch.id)
      setPlan(null)
    } finally {
      setBusy(false)
    }
  }, [plan])

  return { plan, busy, open, close, confirm }
}
