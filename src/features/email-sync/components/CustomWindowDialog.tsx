import { useState } from 'react'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { DialogActions } from '#/components/dialog/DialogActions'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { lookbackSince } from '#/features/email-sync/data/windows'
import {
  addDays,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import { useConfigLimits } from '#/lib/config/appConfig'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  onClose: () => void
  onPick: (days: number) => void
}

const DEFAULT_DAYS_BACK = 14

/** A backfill from any date the server's lookback ceiling allows, up to today. */
export function CustomWindowDialog({ onClose, onPick }: Props) {
  const maxLookbackDays = useConfigLimits().emailSyncMaxLookbackDays
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const today = startOfToday()
  const [since, setSince] = useState(() =>
    ymd(addDays(today, -DEFAULT_DAYS_BACK)),
  )
  const days = lookbackSince(since, today, maxLookbackDays)

  const submit = () => {
    if (days === null) return
    onPick(days)
    onClose()
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Sync from a date"
      description="Read again under today’s rules. What you already reviewed stays reviewed."
      contentClassName="sm:max-w-[400px]"
      footer={
        <DialogActions
          hint={
            days === null
              ? `Pick a date from the last ${maxLookbackDays} days`
              : null
          }
          onCancel={onClose}
          submitLabel="Sync"
          onSubmit={submit}
          ready={days !== null}
        />
      }
    >
      <div>
        <FieldLabel>Emails received since</FieldLabel>
        <DateField
          value={since}
          onChange={setSince}
          dateFormat={dateFormat}
          invalid={days === null}
          ariaLabel="Emails received since"
          hint
        />
      </div>
    </ResponsiveDialog>
  )
}
