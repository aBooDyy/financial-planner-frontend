import { Chip, ChipRow } from '#/components/dialog/Chip'
import { FieldLabel } from '#/components/FieldLabel'
import type { GoalFrequency } from '#/features/goals/api/types'
import { FREQUENCIES, FREQUENCY_OPTIONS } from '#/features/goals/constants'

type Props = {
  value: GoalFrequency
  onChange: (frequency: GoalFrequency) => void
  /** Adds a "Custom" chip; while it is chosen, no preset reads as chosen. */
  custom?: { active: boolean; onSelect: () => void }
}

/** "How often?" as one-tap chips, one per cadence. */
export function FrequencyChips({ value, onChange, custom }: Props) {
  return (
    <div>
      <FieldLabel>How often?</FieldLabel>
      <ChipRow label="How often?">
        {FREQUENCY_OPTIONS.map((f) => (
          <Chip
            key={f}
            active={!custom?.active && value === f}
            onClick={() => onChange(f)}
          >
            {FREQUENCIES[f].label}
          </Chip>
        ))}
        {custom ? (
          <Chip active={custom.active} onClick={custom.onSelect}>
            Custom
          </Chip>
        ) : null}
      </ChipRow>
    </div>
  )
}
