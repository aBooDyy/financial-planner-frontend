import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LocalInboundImport } from '#/db/types'
import {
  READ_FIELDS,
  displayLines,
  fieldForTap,
  lineSegments,
  locateReads,
  tappedText,
} from '#/features/inbound-imports/data/bodyReads'
import type {
  ReadField,
  ReadValues,
  Segment,
} from '#/features/inbound-imports/data/bodyReads'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { cn } from '#/lib/utils'
import { FixRuleLink } from './FixRuleLink'
import { SourceChip } from './SourceChip'

type Props = {
  item: LocalInboundImport
  detail: ImportDetail | null
  loading: boolean
  error: string | null
  values: ReadValues
  target: ReadField
  onTarget: (field: ReadField) => void
  onUse: (field: ReadField, text: string) => void
  /** Open from the start, when the form still needs something only the body can give. */
  defaultOpen?: boolean
}

const LABEL: Record<ReadField, string> = {
  amount: 'Amount',
  currency: 'Currency',
  merchant: 'Merchant',
}

function FieldChips({
  values,
  target,
  onTarget,
}: Pick<Props, 'values' | 'target' | 'onTarget'>) {
  return (
    <div
      role="group"
      aria-label="Field a tap fills"
      className="flex flex-wrap gap-1.5"
    >
      {READ_FIELDS.map(({ field, label }) => {
        const active = field === target
        return (
          <button
            key={field}
            type="button"
            aria-pressed={active}
            onClick={() => onTarget(field)}
            className={cn(
              'inline-flex max-w-full items-center gap-[7px] rounded-full border-[1.5px] px-[11px] py-1.5 text-[12.5px] whitespace-nowrap',
              active
                ? 'border-fp-accent bg-[color-mix(in_srgb,var(--fp-accent)_12%,var(--fp-surface))] font-extrabold'
                : 'border-fp-border bg-fp-surface font-semibold hover:border-fp-border-strong',
            )}
          >
            {label}
            <span
              className={cn(
                'min-w-0 truncate',
                active ? 'font-semibold text-fp-text-2' : 'text-fp-text-3',
              )}
            >
              <bdi>{values[field].trim() || 'Not set'}</bdi>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Line({
  text,
  segments,
  target,
  onTap,
}: {
  text: string
  segments: Segment[]
  target: ReadField
  onTap: (index: number, field: ReadField) => void
}) {
  return (
    <div
      dir="auto"
      className="px-2 py-1 font-mono text-[12.5px] leading-[1.9] [overflow-wrap:anywhere] whitespace-pre-wrap text-fp-text"
    >
      {text.trim() ? null : ' '}
      {segments.map((segment, i) => {
        if (segment.kind === 'plain') return segment.text
        if (segment.kind === 'read') {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-[5px] rounded-[6px] bg-[color-mix(in_srgb,var(--fp-accent)_16%,var(--fp-surface))] ps-[5px] pe-[3px] align-baseline font-bold whitespace-nowrap text-fp-accent-ink"
            >
              {segment.text}
              <span className="rounded-full bg-fp-accent px-1.5 py-px font-sans text-[10px] leading-[1.5] font-extrabold text-white">
                {LABEL[segment.field]}
              </span>
            </span>
          )
        }
        const field = fieldForTap(segment.shape, target)
        if (!field) return segment.text
        const loud = segment.shape !== 'word'
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTap(segment.index, field)}
            aria-label={`Use “${segment.text}” as the ${field}`}
            className={cn(
              'rounded-[3px] px-0.5 whitespace-nowrap hover:bg-fp-surface-2',
              loud
                ? 'border-b-[1.5px] border-dashed border-fp-text-3'
                : 'hover:text-fp-accent-ink',
            )}
          >
            {segment.text}
          </button>
        )
      })}
    </div>
  )
}

function Notice({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <p
      className={cn(
        'px-3 py-3 text-[12.5px]',
        danger ? 'font-semibold text-fp-danger' : 'text-fp-text-3',
      )}
    >
      {children}
    </p>
  )
}

/**
 * The stored email or payload under the form, folded to its sender and subject, with what was
 * read highlighted in place. Pick a field, then tap the text that belongs to it; numbers and
 * currency codes fill their own field.
 */
export function ReviewEmail({
  item,
  detail,
  loading,
  error,
  values,
  target,
  onTarget,
  onUse,
  defaultOpen,
}: Props) {
  const noun = bodyNoun(item.bodyFormat)
  const lines = useMemo(
    () =>
      detail
        ? displayLines(item.bodyFormat, detail.bodyLines, detail.bodyTruncated)
        : [],
    [detail, item.bodyFormat],
  )
  const reads = locateReads(lines, values)
  const inbox = item.source === 'inbox'

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group/email overflow-hidden rounded-[14px] border-[1.5px] border-fp-border"
    >
      <div className="flex items-center gap-[10px] bg-fp-surface-2 px-3 py-[10px] text-[12.5px]">
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start">
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2.2}
            className="shrink-0 text-fp-text-3 transition-transform group-data-[state=open]/email:rotate-180"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-[5px] font-bold">
              {inbox ? null : <SourceChip source={item.source} />}
              <bdi className="truncate">
                {inbox
                  ? (item.sourceRef ?? item.sourceLabel)
                  : (item.sourceLabel ?? 'Webhook')}
              </bdi>
            </div>
            <div className="truncate text-fp-text-2">
              <bdi>
                {inbox ? item.subject || '(no subject)' : 'Webhook payload'}
              </bdi>
            </div>
          </div>
        </CollapsibleTrigger>
        <FixRuleLink item={item} />
      </div>

      <CollapsibleContent>
        {loading ? (
          <Notice>{`Loading the ${noun}…`}</Notice>
        ) : error ? (
          <Notice danger>{error}</Notice>
        ) : !item.hasBody || lines.length === 0 ? (
          <Notice>{`This import was logged before ${noun}s were kept, so its content isn’t stored.`}</Notice>
        ) : (
          <>
            <div className="flex flex-col gap-2 px-3 pt-[10px] pb-1">
              <div className="text-[12px] font-bold text-fp-text-2">
                Wrong? Pick a field, then tap its text
              </div>
              <FieldChips values={values} target={target} onTarget={onTarget} />
            </div>
            <div className="flex max-h-[320px] flex-col gap-0.5 overflow-auto px-2 pt-1.5 pb-[10px]">
              {lines.map((text, index) => {
                const { segments, tokens } = lineSegments(
                  text,
                  reads.get(index) ?? [],
                )
                return (
                  <Line
                    key={index}
                    text={text}
                    segments={segments}
                    target={target}
                    onTap={(token, field) =>
                      onUse(field, tappedText(text, tokens, token, field))
                    }
                  />
                )
              })}
            </div>
            {detail?.bodyTruncated ? (
              <p className="px-3 pb-2.5 text-[11.5px] text-fp-text-3">
                {`Long ${noun} — only the first part was kept.`}
              </p>
            ) : null}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
