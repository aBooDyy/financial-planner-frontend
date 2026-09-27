import { Chip, ChipRow } from '#/components/dialog/Chip'
import { FieldLabel } from '#/components/FieldLabel'
import type {
  ExtractField,
  FieldPicks,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { FIELD_LABEL, tappableFields } from '#/features/email-sync/data/fields'
import { cn } from '#/lib/utils'

type Props = {
  target: ExtractField | null
  picks: FieldPicks
  options: LearnOptions
  onTarget: (field: ExtractField) => void
}

const LABEL = 'Pick a tag, then tap its line'

/** What the next tap on the email fills; the dot says whether it is tagged yet. */
export function FieldTargetChips({ target, picks, options, onTarget }: Props) {
  return (
    <div className="min-w-0">
      <FieldLabel>{LABEL}</FieldLabel>
      <ChipRow label={LABEL}>
        {tappableFields(options).map((field) => (
          <Chip
            key={field}
            active={target === field}
            color="var(--fp-accent)"
            onClick={() => onTarget(field)}
          >
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                picks[field] !== null ? 'bg-fp-accent' : 'bg-fp-border-strong',
              )}
            />
            {FIELD_LABEL[field]}
            {field === 'merchant' ? ' · optional' : null}
            {picks[field] !== null ? (
              <span className="sr-only">, tagged</span>
            ) : null}
          </Chip>
        ))}
      </ChipRow>
    </div>
  )
}
