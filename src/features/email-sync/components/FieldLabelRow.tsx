import type {
  ExtractField,
  LearnedLabel,
} from '#/features/email-sync/api/types'
import { FIELD_LABEL } from '#/features/email-sync/data/fields'
import { LABEL_UNVERIFIED } from '#/features/email-sync/data/labels'
import { LabelChip } from './LabelChip'

type Props = {
  field: ExtractField
  /** What the learn found; null while none answers the picks on screen. */
  label: LearnedLabel | null
  pending: boolean
  /** The user chose the label line themselves. */
  overridden: boolean
  /** The next tap on the sample names this field's label. */
  choosing: boolean
  onChoose: (choosing: boolean) => void
  onAuto: () => void
}

const ACTION =
  'shrink-0 text-[12.5px] font-bold text-fp-accent-ink hover:underline'

/** One tagged field: how the rule finds it, and the way to point it at another label. */
export function FieldLabelRow({
  field,
  label,
  pending,
  overridden,
  choosing,
  onChoose,
  onAuto,
}: Props) {
  const name = FIELD_LABEL[field]

  return (
    <li className="flex min-w-0 flex-col gap-1 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="w-[68px] shrink-0 text-[12.5px] font-semibold text-fp-text-2">
          {name}
        </span>
        {label ? (
          <LabelChip field={field} label={label} />
        ) : (
          <span className="text-[12.5px] text-fp-text-3" aria-live="polite">
            {pending
              ? 'Finding its label…'
              : overridden
                ? 'By the line you tapped'
                : 'Not read yet'}
          </span>
        )}
        <span className="ms-auto flex items-center gap-3">
          {overridden ? (
            <button
              type="button"
              className={ACTION}
              aria-label={`Find the ${name.toLowerCase()}’s label automatically`}
              onClick={onAuto}
            >
              Auto
            </button>
          ) : null}
          <button
            type="button"
            className={ACTION}
            aria-pressed={choosing}
            aria-label={
              choosing
                ? `Stop choosing the ${name.toLowerCase()}’s label`
                : `Change the ${name.toLowerCase()}’s label`
            }
            onClick={() => onChoose(!choosing)}
          >
            {choosing ? 'Cancel' : 'Change label'}
          </button>
        </span>
      </div>
      {label && !label.verified ? (
        <p role="alert" className="text-[12px] font-semibold text-fp-warn">
          {LABEL_UNVERIFIED}
        </p>
      ) : null}
    </li>
  )
}
