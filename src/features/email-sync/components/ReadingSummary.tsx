import type { ExtractField, Extraction } from '#/features/email-sync/api/types'
import { FIELD_LABEL } from '#/features/email-sync/data/fields'
import {
  fieldText,
  fieldTone,
  moneyText,
} from '#/features/email-sync/data/readings'
import type { ReadingTone } from '#/features/email-sync/data/readings'
import { cn } from '#/lib/utils'

const TONE: Record<ReadingTone, string> = {
  ok: 'bg-fp-accent',
  warn: 'bg-fp-warn',
  idle: 'bg-fp-border-strong',
}

const FIELDS: ExtractField[] = ['amount', 'currency', 'merchant']

type Props = {
  reading: Extraction | null
  pending: boolean
  error: string | null
}

/** What the rule reads from the sample itself, field by field — the proof it learned right. */
export function ReadingSummary({ reading, pending, error }: Props) {
  if (error) {
    return (
      <p role="alert" className="text-[12.5px] text-fp-danger">
        {error}
      </p>
    )
  }
  if (!reading) {
    return (
      <p className="text-[12.5px] text-fp-text-3" aria-live="polite">
        {pending
          ? 'Reading your sample…'
          : 'Tap the amount and the currency to see what this rule reads.'}
      </p>
    )
  }
  const money = moneyText(reading)

  return (
    <div
      aria-live="polite"
      className={cn(
        'rounded-[14px] bg-fp-surface-2 px-[14px] py-3 transition-opacity',
        pending && 'opacity-60',
      )}
    >
      <div className="text-[12px] font-bold text-fp-text-2">
        This email reads as
      </div>
      <div className="mt-0.5 mb-1.5 text-[26px] font-extrabold tracking-[-0.02em] tabular-nums">
        {money ? (
          <bdi>{money}</bdi>
        ) : (
          <span className="text-fp-warn">Not a complete amount</span>
        )}
      </div>
      <ul>
        {FIELDS.map((field) => {
          const r = reading.fields[field]
          return (
            <li
              key={field}
              className="flex items-center gap-[9px] border-t border-fp-border py-1.5 text-[13px]"
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${TONE[fieldTone(r)]}`}
              />
              <span className="w-[74px] shrink-0 font-semibold text-fp-text-2">
                {FIELD_LABEL[field]}
              </span>
              <span className="min-w-0 truncate font-bold text-fp-text">
                <bdi>{fieldText(field, r)}</bdi>
                {r.status === 'heuristic' ? (
                  <span className="font-medium text-fp-text-3">
                    {' '}
                    (guessed from a label)
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
