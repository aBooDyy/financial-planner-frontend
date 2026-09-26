import { Check } from 'lucide-react'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { FieldLabel } from '#/components/FieldLabel'
import type {
  ExtractField,
  FieldPicks,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { FIELD_LABEL, tappableFields } from '#/features/email-sync/data/fields'

type Props = {
  target: ExtractField | null
  picks: FieldPicks
  options: LearnOptions
  onTarget: (field: ExtractField) => void
}

/** What the next tap on the email fills. The merchant is optional. */
export function FieldTargetChips({ target, picks, options, onTarget }: Props) {
  return (
    <div className="min-w-0">
      <FieldLabel>Tap the email to fill</FieldLabel>
      <ChipRow label="Tap the email to fill">
        {tappableFields(options).map((field) => (
          <Chip
            key={field}
            active={target === field}
            onClick={() => onTarget(field)}
          >
            {picks[field] !== null ? (
              <Check size={13} strokeWidth={2.6} />
            ) : null}
            {FIELD_LABEL[field]}
            {field === 'merchant' ? ' · optional' : null}
          </Chip>
        ))}
      </ChipRow>
    </div>
  )
}
