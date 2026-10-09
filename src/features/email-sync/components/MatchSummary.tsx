import { Check, TriangleAlert } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import type {
  InboxMessage,
  SampleVerdict,
} from '#/features/email-sync/api/types'
import { extractionLine } from '#/features/text-templates/data/readings'
import { focusMatches } from '#/features/email-sync/data/verdicts'
import { cn } from '#/lib/utils'

const SHOWN = 5

type Props = {
  verdicts: SampleVerdict[] | null
  /** The rule being edited, as the tested set places it; null when it can't be tested yet. */
  focusIndex: number | null
  messages: InboxMessage[]
  pending: boolean
  error: string | null
}

/** Which of the inbox's recent emails the filter lets through, and what each reads as. */
export function MatchSummary({
  verdicts,
  focusIndex,
  messages,
  pending,
  error,
}: Props) {
  if (focusIndex === null) {
    return (
      <p className="text-[12.5px] text-fp-text-3">
        Once the rule reads your sample, you’ll see which recent emails it picks
        up.
      </p>
    )
  }
  if (error) {
    return (
      <p role="alert" className="text-[12.5px] text-fp-danger">
        {error}
      </p>
    )
  }
  if (!verdicts) {
    return (
      <p className="text-[12.5px] text-fp-text-3">
        {pending
          ? 'Checking your recent emails…'
          : 'No recent emails to check.'}
      </p>
    )
  }

  const { total, matched, takenEarlier } = focusMatches(verdicts, focusIndex)
  const subjectOf = new Map(messages.map((m) => [m.id, m.subject]))

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex flex-col gap-[10px] transition-opacity',
        pending && 'opacity-60',
      )}
    >
      <NoteBox
        tone={matched.length > 0 ? 'accent' : 'neutral'}
        icon={matched.length > 0 ? <Check strokeWidth={2.4} /> : undefined}
      >
        Matches {matched.length} of {total} recent emails
      </NoteBox>
      {takenEarlier > 0 ? (
        <NoteBox tone="warn" icon={<TriangleAlert />}>
          {takenEarlier} of them {takenEarlier === 1 ? 'is' : 'are'} taken by a
          rule higher in the list. Move this rule up to handle{' '}
          {takenEarlier === 1 ? 'it' : 'them'} here.
        </NoteBox>
      ) : null}
      {matched.length > 0 ? (
        <ul className="rounded-[12px] border-[1.5px] border-fp-border">
          {matched.slice(0, SHOWN).map((v, index) => {
            const reading = v.focus?.extraction ?? null
            return (
              <li
                key={v.sampleId ?? index}
                className="flex items-center gap-2.5 border-b border-fp-border px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fp-text-2">
                  <bdi>
                    {(v.sampleId && subjectOf.get(v.sampleId)) ||
                      '(no subject)'}
                  </bdi>
                </span>
                {reading ? (
                  <span
                    className={cn(
                      'shrink-0 text-[12.5px] font-semibold tabular-nums',
                      reading.complete ? 'text-fp-text' : 'text-fp-warn',
                    )}
                  >
                    <bdi>{extractionLine(reading)}</bdi>
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-fp-text-3">
          None of the recent emails get through this filter.
        </p>
      )}
    </div>
  )
}
