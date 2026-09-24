import type { ConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { usePreferencesStore } from '#/stores/preferences'

const SECONDARY = 'flex-1 rounded-[11px] py-[10px] text-[13px] text-fp-text-2'

/** 1d's secondary actions: Move date (inline picker) · Skip this one · Close the rest. */
export function ConfirmPlannedSecondary({ f }: { f: ConfirmForm }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  if (!f.form) return null
  const partial = f.settled > 0

  if (f.form.moveDate !== null) {
    return (
      <div className="flex w-full items-end gap-2 rounded-[12px] border border-fp-border bg-fp-surface-2 p-[10px]">
        <div className="min-w-0 flex-1">
          <span className="mb-[6px] block text-[12px] font-semibold text-fp-text-2">
            Move to
          </span>
          <DateField
            value={f.form.moveDate}
            onChange={f.setMoveDate}
            dateFormat={dateFormat}
            ariaLabel="New date"
          />
        </div>
        <Button type="button" variant="ghost" onClick={f.cancelMove}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={f.move}
          disabled={f.busy || !f.form.moveDate}
        >
          Move
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-[10px]">
      <Button
        type="button"
        variant="outline"
        className={SECONDARY}
        onClick={f.startMove}
        disabled={f.busy}
      >
        Move date
      </Button>
      {partial ? (
        <Button
          type="button"
          variant="outline"
          className={SECONDARY}
          onClick={f.closeRest}
          disabled={f.busy}
        >
          Close the rest
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={SECONDARY}
          onClick={f.skip}
          disabled={f.busy}
        >
          Skip this one
        </Button>
      )}
    </div>
  )
}
