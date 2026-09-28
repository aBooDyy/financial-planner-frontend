import { useState } from 'react'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DialogActions } from '#/components/dialog/DialogActions'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  customRangePresets,
  customRangeProblem,
} from '#/features/transactions/data/customRange'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import { startOfToday } from '#/features/transactions/data/planning'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  /** The span the fields open on — the period on screen. */
  initial: IsoSpan
  onPick: (span: IsoSpan) => void
  onClose: () => void
}

/** Picks any from–to span for the Spending page, both ends included. */
export function CustomRangeDialog({ initial, onPick, onClose }: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const [span, setSpan] = useState(initial)
  const presets = customRangePresets(startOfToday())
  const problem = customRangeProblem(span)

  const submit = () => {
    if (problem) return
    onPick(span)
    onClose()
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Custom range"
      description="Show any stretch of time, from one date to another."
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          hint={problem}
          onCancel={onClose}
          submitLabel="Show"
          onSubmit={submit}
          ready={!problem}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <ChipRow label="Quick ranges">
          {presets.map((p) => (
            <Chip
              key={p.key}
              size="sm"
              active={p.span.start === span.start && p.span.end === span.end}
              onClick={() => setSpan(p.span)}
            >
              {p.label}
            </Chip>
          ))}
        </ChipRow>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>From</FieldLabel>
            <DateField
              value={span.start}
              onChange={(start) => setSpan((s) => ({ ...s, start }))}
              dateFormat={dateFormat}
              invalid={problem !== null && span.start > span.end}
              ariaLabel="From"
            />
          </div>
          <div>
            <FieldLabel>To</FieldLabel>
            <DateField
              value={span.end}
              onChange={(end) => setSpan((s) => ({ ...s, end }))}
              dateFormat={dateFormat}
              invalid={problem !== null && span.start > span.end}
              ariaLabel="To"
            />
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
