import type {
  ExtractField,
  FieldPicks,
  LearnOptions,
  LearnedLabels,
} from '#/features/email-sync/api/types'
import { tappableFields } from '#/features/email-sync/data/fields'
import { FieldLabelRow } from './FieldLabelRow'

type Props = {
  picks: FieldPicks
  options: LearnOptions
  labels: LearnedLabels | null
  pending: boolean
  labelFor: ExtractField | null
  onLabelMode: (field: ExtractField | null) => void
  onAuto: (field: ExtractField) => void
}

/** How the rule finds each tagged field, with a way to name another label line for it. */
export function FieldLabels({
  picks,
  options,
  labels,
  pending,
  labelFor,
  onLabelMode,
  onAuto,
}: Props) {
  const fields = tappableFields(options).filter((f) => picks[f] !== null)
  const chosen = fields.some((f) => picks[f]?.labelLine !== undefined)
  if (fields.length === 0) return null
  if (!labels && !pending && !chosen && labelFor === null) return null

  return (
    <ul
      aria-label="How the rule finds each value"
      className="flex flex-col divide-y divide-fp-border rounded-[12px] border-[1.5px] border-fp-border px-3 py-0.5"
    >
      {fields.map((field) => (
        <FieldLabelRow
          key={field}
          field={field}
          label={labels?.[field] ?? null}
          pending={pending}
          overridden={picks[field]?.labelLine !== undefined}
          choosing={labelFor === field}
          onChoose={(choosing) => onLabelMode(choosing ? field : null)}
          onAuto={() => onAuto(field)}
        />
      ))}
    </ul>
  )
}
