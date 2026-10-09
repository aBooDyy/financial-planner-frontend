import { AlertTriangle, Check } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { EmailSample, Extraction } from '#/features/email-sync/api/types'
import {
  extractionLine,
  groupScore,
} from '#/features/text-templates/data/readings'
import { cn } from '#/lib/utils'

type Props = {
  similar: EmailSample[]
  readings: Extraction[]
  pending: boolean
}

/**
 * The learned rule tried on every email that looks like the sample. A template that reads
 * them all is the one to keep; one that misses some says which.
 */
export function GroupPreview({ similar, readings, pending }: Props) {
  if (similar.length === 0 || readings.length === 0) return null
  const { read, total } = groupScore(readings)
  const all = read === total

  return (
    <div
      className={cn(
        'flex flex-col gap-2 transition-opacity',
        pending && 'opacity-60',
      )}
    >
      <div role="status">
        <NoteBox
          tone={all ? 'accent' : 'warn'}
          icon={all ? <Check strokeWidth={2.4} /> : <AlertTriangle />}
        >
          Read {read} of {total} similar {total === 1 ? 'email' : 'emails'}
        </NoteBox>
      </div>
      <ul className="max-h-[220px] overflow-auto rounded-[12px] border-[1.5px] border-fp-border">
        {readings.map((reading, index) => {
          const sample = similar[index] as EmailSample | undefined
          return (
            <li
              key={sample?.id ?? index}
              className="flex items-center gap-2.5 border-b border-fp-border px-3 py-2 last:border-b-0"
            >
              {reading.complete ? (
                <Check
                  size={13}
                  strokeWidth={2.4}
                  className="shrink-0 text-fp-accent-ink"
                  aria-label="Read"
                />
              ) : (
                <AlertTriangle
                  size={13}
                  strokeWidth={2}
                  className="shrink-0 text-fp-warn"
                  aria-label="Not read"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fp-text-2">
                <bdi>{sample?.subject || '(no subject)'}</bdi>
              </span>
              <span
                className={cn(
                  'shrink-0 text-[12.5px] font-semibold tabular-nums',
                  reading.complete ? 'text-fp-text' : 'text-fp-warn',
                )}
              >
                <bdi>{extractionLine(reading)}</bdi>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
