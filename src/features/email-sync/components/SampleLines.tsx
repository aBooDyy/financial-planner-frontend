import type { ReactNode } from 'react'
import type {
  EmailSample,
  ExtractField,
  FieldPick,
  FieldPicks,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { FIELD_LABEL, lineMarks } from '#/features/email-sync/data/fields'
import type { LabelMode } from '#/features/email-sync/data/labels'
import { currencyPickNeeded } from '#/features/email-sync/data/mapping'
import { currencyTokens } from '#/lib/lineTokens'
import { cn } from '#/lib/utils'

type Props = {
  sample: EmailSample
  picks: FieldPicks
  options: LearnOptions
  target: ExtractField | null
  /** A line the rule would read the merchant from without being told, while none is tagged. */
  merchantGuess?: number | null
  /** The lines that label a tagged value, by the fields they label. */
  labelMarks?: Map<number, ExtractField[]>
  labelMode?: LabelMode | null
  onTap: (line: number) => void
}

type Span = [number, number]

const TAG =
  'shrink-0 rounded-full px-[7px] py-0.5 font-sans text-[10.5px] font-extrabold tracking-[0.02em] text-white'
const LABEL_TAG =
  'shrink-0 rounded-full border border-fp-border-strong bg-fp-surface px-[7px] py-px font-sans text-[10.5px] font-extrabold tracking-[0.02em] text-fp-text-2'

/** The pick's own span, else — for a currency — the first code written on its line. */
function spanOf(
  field: ExtractField,
  pick: FieldPick | null,
  index: number,
  line: string,
): Span | null {
  if (!pick || pick.line !== index) return null
  if (pick.start !== undefined && pick.end !== undefined)
    return [pick.start, pick.end]
  if (field !== 'currency') return null
  const code = currencyTokens(line).at(0)
  return code ? [code.start, code.end] : null
}

const names = (fields: ExtractField[]) =>
  fields.map((f) => FIELD_LABEL[f]).join(', ')

/** What a screen reader hears for one line: its text, its marks, and what a press does. */
function lineName(
  line: string,
  tagged: ExtractField[],
  labels: ExtractField[],
  guessed: boolean,
  press: string | null,
): string {
  return [
    line,
    tagged.length ? `tagged ${names(tagged)}` : null,
    labels.length ? `labels ${names(labels)}` : null,
    guessed ? 'may be the merchant' : null,
    press ? `press Enter to ${press}` : null,
  ]
    .filter(Boolean)
    .join(', ')
}

/** The line with its tagged values highlighted in place. */
function LineText({ text, spans }: { text: string; spans: Span[] }) {
  if (spans.length === 0) return <>{text}</>
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (start < at) continue
    parts.push(text.slice(at, start))
    parts.push(
      <span
        key={start}
        className="rounded-[5px] bg-[color-mix(in_srgb,var(--fp-accent)_18%,var(--fp-surface))] px-1 font-bold text-fp-accent-ink"
      >
        {text.slice(start, end)}
      </span>,
    )
    at = end
  }
  parts.push(text.slice(at))
  return <>{parts}</>
}

/**
 * The sample's body, one tappable line each. A tap fills the current tag — or, while a label
 * is being chosen, names it. A tagged line wears its tags beside the highlighted values, a
 * label line wears the fields it labels, and the line under the pointer asks "Merchant?".
 */
export function SampleLines({
  sample,
  picks,
  options,
  target,
  merchantGuess = null,
  labelMarks,
  labelMode = null,
  onTap,
}: Props) {
  const marks = lineMarks(picks, options)
  const guess = picks.merchant === null && !labelMode ? merchantGuess : null
  const choosing = labelMode?.field ?? target
  const press = labelMode
    ? `use as the ${FIELD_LABEL[labelMode.field]}’s label`
    : target
      ? `tag as ${FIELD_LABEL[target]}`
      : null

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
          const labels = labelMarks?.get(index) ?? []
          const spans = (['amount', 'currency'] as const)
            .filter((f) => f === 'amount' || currencyPickNeeded(options))
            .map((f) => spanOf(f, picks[f], index, line))
            .filter((s): s is Span => s !== null)
          const guessed = guess === index
          const tappable = labelMode
            ? labelMode.candidates.has(index)
            : target !== null
          const carries = labelMode ? labels : fields
          const asks =
            choosing !== null && tappable && !carries.includes(choosing)
          return (
            <li key={index}>
              <button
                type="button"
                disabled={!tappable}
                onClick={() => onTap(index)}
                aria-label={lineName(
                  line,
                  fields,
                  labels,
                  guessed,
                  tappable ? press : null,
                )}
                className={cn(
                  'group flex w-full flex-wrap items-center gap-2 rounded-[9px] border-[1.5px] px-[10px] py-[7px] text-start font-mono text-[12.5px] leading-[1.5]',
                  fields.length > 0
                    ? 'border-fp-accent bg-[color-mix(in_srgb,var(--fp-accent)_6%,var(--fp-surface))] text-fp-text'
                    : labels.length > 0
                      ? 'border-fp-border-strong bg-fp-surface-2 text-fp-text'
                      : guessed
                        ? 'border-dashed border-fp-accent text-fp-text'
                        : 'border-transparent text-fp-text-3 enabled:hover:border-dashed enabled:hover:border-fp-accent enabled:hover:text-fp-text',
                  labelMode && !tappable && 'opacity-50',
                  !tappable && 'cursor-default',
                )}
              >
                <span
                  dir="auto"
                  className="min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap"
                >
                  <LineText text={line} spans={spans} />
                </span>
                {fields.map((field) => (
                  <span key={field} className={cn(TAG, 'bg-fp-accent')}>
                    {FIELD_LABEL[field]}
                  </span>
                ))}
                {labels.map((field) => (
                  <span key={`label-${field}`} className={LABEL_TAG}>
                    {FIELD_LABEL[field]} label
                  </span>
                ))}
                {guessed ? (
                  <span aria-hidden className={cn(TAG, 'bg-fp-text-3')}>
                    Merchant?
                  </span>
                ) : asks ? (
                  <span
                    aria-hidden
                    className={cn(
                      TAG,
                      'hidden bg-fp-text-3 group-enabled:group-hover:inline',
                    )}
                  >
                    {FIELD_LABEL[choosing]}
                    {labelMode ? ' label' : ''}?
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
