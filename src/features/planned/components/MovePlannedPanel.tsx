import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Button } from '#/components/ui/button'
import type { ConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { usePreferencesStore } from '#/stores/preferences'

const SMALL = 'h-auto flex-auto rounded-[11px] px-3 py-2 text-[13px] font-bold'

/** "Move date" opened in place of the secondary row: the new date, then Cancel / Move. */
export function MovePlannedPanel({ f }: { f: ConfirmForm }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const moveDate = f.form?.moveDate ?? ''

  return (
    <div className="flex min-w-0 flex-col gap-[10px] rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface-2 p-3">
      <div className="min-w-0">
        <FieldLabel>Move to</FieldLabel>
        <DateField
          value={moveDate}
          onChange={f.setMoveDate}
          dateFormat={dateFormat}
          ariaLabel="New date"
          hint
        />
        <FieldMessage help="A moved date is pinned — the planner won’t move it back." />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="quiet"
          className={SMALL}
          onClick={f.cancelMove}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`${SMALL} bg-fp-accent-soft text-fp-accent-ink hover:bg-fp-accent-soft hover:text-fp-accent-ink hover:brightness-95`}
          onClick={f.move}
          disabled={f.busy || !moveDate}
        >
          Move
        </Button>
      </div>
    </div>
  )
}
