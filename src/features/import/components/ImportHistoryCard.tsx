import { History } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
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
        <EmptyState
          icon={History}
          size="sm"
          framed
          title="Nothing imported yet"
          text="Anything you bring in will be listed here so you can see what it added."
        />
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
