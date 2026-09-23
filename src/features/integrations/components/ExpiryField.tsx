import { useState } from 'react'
import { DateField } from '#/components/DateField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  EXPIRY_PRESETS,
  endOfDayIso,
  expiryDay,
  presetExpiry,
} from '#/features/integrations/data/expiry'
import type { ExpiryPreset } from '#/features/integrations/data/expiry'
import { formatDate } from '#/lib/date'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  id?: string
  /** An ISO timestamp, or null for a key that never expires. */
  value: string | null
  onChange: (expiresAt: string | null) => void
  invalid?: boolean
  disabled?: boolean
}

export function ExpiryField({ id, value, onChange, invalid, disabled }: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const [mode, setMode] = useState<ExpiryPreset>(
    value === null ? 'never' : 'date',
  )

  const pick = (next: ExpiryPreset) => {
    setMode(next)
    if (next === 'never') onChange(null)
    else if (next !== 'date') onChange(presetExpiry(next))
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={mode}
        onValueChange={(v) => pick(v as ExpiryPreset)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXPIRY_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === 'date' ? (
        <DateField
          value={expiryDay(value)}
          onChange={(day) => onChange(day ? endOfDayIso(day) : null)}
          dateFormat={dateFormat}
          invalid={invalid}
          ariaLabel="Expiry date"
        />
      ) : mode !== 'never' && value ? (
        <span className="text-[12px] text-fp-text-3">
          Stops working after {formatDate(new Date(value), dateFormat)}
        </span>
      ) : null}
    </div>
  )
}
