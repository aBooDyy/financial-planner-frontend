import { useState } from 'react'
import { Chip, ChipRow } from '#/components/dialog/Chip'
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
  /** One-tap chips where there is room for them; a select in a tight column. */
  variant?: 'chips' | 'select'
}

export function ExpiryField({
  id,
  value,
  onChange,
  invalid,
  disabled,
  variant = 'select',
}: Props) {
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
      {variant === 'chips' ? (
        <div id={id}>
          <ChipRow label="Expires">
            {EXPIRY_PRESETS.map((p) => (
              <Chip
                key={p.value}
                active={mode === p.value}
                disabled={disabled}
                onClick={() => pick(p.value)}
              >
                {p.label}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : (
        <Select
          value={mode}
          onValueChange={(v) => pick(v as ExpiryPreset)}
          disabled={disabled}
        >
          <SelectTrigger id={id} aria-invalid={invalid}>
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
      )}
      {mode === 'date' ? (
        <DateField
          value={expiryDay(value)}
          onChange={(day) => onChange(day ? endOfDayIso(day) : null)}
          dateFormat={dateFormat}
          invalid={invalid}
          ariaLabel="Expiry date"
          hint
        />
      ) : mode !== 'never' && value ? (
        <span className="text-[12px] font-medium text-fp-text-3">
          Stops working after {formatDate(new Date(value), dateFormat)}
        </span>
      ) : null}
    </div>
  )
}
