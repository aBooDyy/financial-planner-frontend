import type {
  EmailSample,
  ExtractField,
  FieldPicks,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { FIELD_LABEL, lineMarks } from '#/features/email-sync/data/fields'
import { cn } from '#/lib/utils'

type Props = {
  sample: EmailSample
  picks: FieldPicks
  options: LearnOptions
  target: ExtractField | null
  onTap: (line: number) => void
}

/** The amount's own span, underlined inside its line when the user pinned one. */
function LineText({
  text,
  span,
}: {
  text: string
  span: [number, number] | null
}) {
  if (!span) return <>{text}</>
  const [start, end] = span
  return (
    <>
      {text.slice(0, start)}
      <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--fp-accent)_18%,var(--fp-surface))] px-1 font-bold text-fp-accent-ink">
        {text.slice(start, end)}
      </span>
      {text.slice(end)}
    </>
  )
}

/**
 * The sample's body, one tappable line each. A tap fills the current target; each line says
 * which fields it carries, in words beside the highlight.
 */
export function SampleLines({ sample, picks, options, target, onTap }: Props) {
  const marks = lineMarks(picks, options)
  const amount = picks.amount
  const hint = target ? `, press Enter to use for ${FIELD_LABEL[target]}` : ''

  return (
    <div className="overflow-hidden rounded-[14px] border-[1.5px] border-fp-border">
      <div className="bg-fp-surface-2 px-3 py-[10px] text-[12.5px]">
        <div className="truncate font-bold">
          <bdi>{sample.senderName ?? sample.senderEmail}</bdi>
        </div>
        <div className="truncate text-fp-text-2">
          <bdi>{sample.subject || '(no subject)'}</bdi>
        </div>
      </div>
      <ol
        aria-label="The sample email, line by line"
        className="flex max-h-[52vh] flex-col gap-0.5 overflow-auto p-2"
      >
        {sample.bodyLines.map((line, index) => {
          if (!line.trim()) return null
          const fields = marks.get(index) ?? []
          const span =
            amount?.line === index &&
            amount.start !== undefined &&
            amount.end !== undefined
              ? ([amount.start, amount.end] as [number, number])
              : null
          return (
            <li key={index}>
              <button
                type="button"
                disabled={!target}
                onClick={() => onTap(index)}
                aria-label={`${line}${fields.length ? `, fills ${fields.map((f) => FIELD_LABEL[f]).join(', ')}` : ''}${hint}`}
                className={cn(
                  'flex w-full flex-wrap items-center gap-2 rounded-[9px] border-[1.5px] px-[10px] py-[7px] text-start font-mono text-[12.5px] leading-[1.5]',
                  fields.length > 0
                    ? 'border-fp-accent bg-[color-mix(in_srgb,var(--fp-accent)_6%,var(--fp-surface))] text-fp-text'
                    : 'border-transparent text-fp-text-3 enabled:hover:border-dashed enabled:hover:border-fp-accent enabled:hover:text-fp-text',
                  !target && 'cursor-default',
                )}
              >
                <span
                  dir="auto"
                  className="min-w-0 flex-1 [overflow-wrap:anywhere] whitespace-pre-wrap"
                >
                  <LineText text={line} span={span} />
                </span>
                {fields.map((field) => (
                  <span
                    key={field}
                    className="shrink-0 rounded-full bg-fp-accent px-[7px] py-0.5 font-sans text-[10.5px] font-extrabold tracking-[0.02em] text-white"
                  >
                    {FIELD_LABEL[field]}
                  </span>
                ))}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
