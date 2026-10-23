import { useState } from 'react'
import { Pause } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DateField } from '#/components/DateField'
import {
  PAUSE_PRESETS,
  formatResume,
  presetPause,
  startOfDayIso,
} from '#/features/integrations/data/pause'
import type { PausePreset } from '#/features/integrations/data/pause'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  open: boolean
  keyName: string
  busy: boolean
  error: string | null
  onConfirm: (until: string) => void
  onClose: () => void
}

/** The resume time is worked out when Pause is pressed, so "1 hour" means an hour from then. */
export function PauseKeyDialog({
  open,
  keyName,
  busy,
  error,
  onConfirm,
  onClose,
}: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const [preset, setPreset] = useState<PausePreset>('1d')
  const [day, setDay] = useState('')

  const resumeAt = (now: Date): string | null => {
    if (preset !== 'day') return presetPause(preset, now)
    if (!day) return null
    const at = startOfDayIso(day)
    return new Date(at).getTime() > now.getTime() ? at : null
  }
  const preview = resumeAt(new Date())

  return (
    <ConfirmDialog
      open={open}
      contentClassName="sm:max-w-[440px]"
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Pause “${keyName}”?`}
      tone="neutral"
      icon={<Pause />}
      confirmLabel={busy ? 'Pausing…' : 'Pause'}
      confirmVariant="default"
      confirmDisabled={preview === null}
      onConfirm={() => {
        const until = resumeAt(new Date())
        if (until) onConfirm(until)
      }}
      busy={busy}
      error={error}
    >
      <div className="flex flex-col gap-3">
        <p>
          It refuses new transactions until then and starts again on its own.
          Anything sent meanwhile isn’t added, but shows in its delivery log.
        </p>
        <ChipRow label="Pause for">
          {PAUSE_PRESETS.map((p) => (
            <Chip
              key={p.value}
              active={preset === p.value}
              disabled={busy}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </Chip>
          ))}
        </ChipRow>
        {preset === 'day' ? (
          <DateField
            value={day}
            onChange={setDay}
            dateFormat={dateFormat}
            invalid={day !== '' && preview === null}
            ariaLabel="Resume on"
            hint
          />
        ) : null}
        <span className="text-[12px] font-medium text-fp-text-3">
          {preview
            ? `Starts again ${formatResume(preview, locale, dateFormat)}`
            : day
              ? 'Choose a day after today.'
              : 'Choose the day it starts again.'}
        </span>
      </div>
    </ConfirmDialog>
  )
}
