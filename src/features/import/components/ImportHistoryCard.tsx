import { History } from 'lucide-react'
import { useImportHistory } from '#/features/import/hooks/useImportHistory'
import { useUndoImport } from '#/features/import/hooks/useUndoImport'
import { ImportHistoryRow } from './ImportHistoryRow'
import { UndoImportDialog } from './UndoImportDialog'

const CARD = 'rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

/** Recent imports, and the one place an import can be taken back. */
export function ImportHistoryCard() {
  const { batches } = useImportHistory()
  const undo = useUndoImport()

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-bold">Recent imports</h2>

      {batches.length === 0 ? (
        <div
          className={`${CARD} flex items-center gap-3 p-[18px] text-[13px] text-fp-text-3`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-fp-surface-2 text-fp-text-3">
            <History size={18} strokeWidth={1.8} />
          </span>
          <span>
            Nothing imported yet. Anything you bring in will be listed here so
            you can see what it added.
          </span>
        </div>
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          {batches.map((batch) => (
            <ImportHistoryRow
              key={batch.id}
              batch={batch}
              onUndo={() => void undo.open(batch.id)}
            />
          ))}
        </div>
      )}

      <UndoImportDialog
        plan={undo.plan}
        busy={undo.busy}
        onClose={undo.close}
        onConfirm={() => void undo.confirm()}
      />
    </section>
  )
}
