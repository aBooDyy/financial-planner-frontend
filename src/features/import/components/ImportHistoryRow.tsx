import { Button } from '#/components/ui/button'
import { batchPlan, planLabel } from '#/features/import/data/importCounts'
import { formatDate, formatRelativeTime, parseISODate } from '#/lib/date'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'
import type { LocalImportBatch } from '#/db/types'

type Props = {
  batch: LocalImportBatch
  onUndo: () => void
}

export function ImportHistoryRow({ batch, onUndo }: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const locale = useDirectionStore((s) => s.locale)
  const day = parseISODate(batch.createdAt.slice(0, 10))
  // "2 days ago" is what makes an import recognisable; the date itself is on the tooltip.
  const when = formatRelativeTime(batch.createdAt, locale)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-fp-border px-[16px] py-3 text-[13px] last:border-b-0">
      <span
        className="min-w-0 flex-1 truncate"
        title={day ? formatDate(day, dateFormat) : undefined}
      >
        <span className="font-semibold text-fp-text">{batch.label}</span>
        <span className="text-fp-text-2">
          {' · '}
          {planLabel(batchPlan(batch))}
          {when ? ` · ${when}` : ''}
        </span>
      </span>

      {batch.undoneAt === null ? (
        <Button
          type="button"
          variant="outline"
          className="px-[12px] py-[7px] text-[12.5px]"
          onClick={onUndo}
        >
          Undo
        </Button>
      ) : (
        <span className="text-[12.5px] text-fp-text-3">Undone</span>
      )}
    </div>
  )
}
