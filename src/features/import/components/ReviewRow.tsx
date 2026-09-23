import { memo, useMemo } from 'react'
import { Info, Pencil } from 'lucide-react'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { describeRow } from '#/features/import/data/rowView'
import type { RowLabels } from '#/features/import/data/rowView'
import type { RowStatus } from '#/features/import/data/review'
import type { ParsedRow } from '#/features/import/data/types'

type Props = {
  row: ParsedRow
  labels: RowLabels
  id: string
  /** 1-based position in the whole filtered list, which the DOM no longer carries. */
  rowIndex: number
  /** The keyboard cursor sits on this row. */
  active: boolean
  height: number
  compact: boolean
  onToggle: (index: number, excluded: boolean) => void
  onEdit: (row: ParsedRow) => void
}

export const REVIEW_GRID =
  'grid grid-cols-[28px_84px_minmax(0,1fr)_104px_minmax(0,0.66fr)_minmax(0,0.5fr)_96px_62px] items-center gap-3'

/** Status is a glyph *and* a word: colour alone is not a signal everyone receives. */
const STATUS: Readonly<Record<RowStatus, { glyph: string; label: string }>> = {
  ok: { glyph: '✅', label: 'Ready' },
  warning: { glyph: '⚠', label: 'Warning' },
  error: { glyph: '⛔', label: 'Error' },
  duplicate: { glyph: '⧉', label: 'Duplicate' },
}

const STATUS_TONE: Readonly<Record<RowStatus, string>> = {
  ok: 'text-fp-accent-ink',
  warning: 'text-fp-text-2',
  error: 'text-fp-danger',
  duplicate: 'text-fp-text-3',
}

function StatusChip({ status }: { status: RowStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${STATUS_TONE[status]}`}
    >
      <span aria-hidden>{STATUS[status].glyph}</span>
      {STATUS[status].label}
    </span>
  )
}

function DuplicateInfo({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="What this row matched"
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text"
      >
        <Info size={14} strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="w-[min(280px,calc(100vw-32px))] text-[12.5px] text-fp-text-2">
        {text}
      </PopoverContent>
    </Popover>
  )
}

/** One row of the file as it will be added — or why it will not be. */
function ReviewRowInner({
  row,
  labels,
  id,
  rowIndex,
  active,
  height,
  compact,
  onToggle,
  onEdit,
}: Props) {
  const view = useMemo(() => describeRow(row, labels), [row, labels])
  const blocked = row.draft === null
  const number = row.index + 1

  const check = (
    <Checkbox
      checked={!row.excluded}
      disabled={blocked}
      aria-label={`Include row ${number}`}
      onCheckedChange={(checked) => onToggle(row.index, checked !== true)}
    />
  )

  const edit = (
    <button
      type="button"
      aria-label={`Edit row ${number}`}
      onClick={() => onEdit(row)}
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text"
    >
      <Pencil size={14} strokeWidth={2} />
    </button>
  )

  const amount = (
    <span
      dir="ltr"
      className={`text-[13.5px] font-bold tabular-nums ${
        view.income ? 'text-fp-accent-ink' : 'text-fp-text'
      }`}
    >
      {view.amount}
    </span>
  )

  // The row's own summary, so a screen reader hears what it is before its cells — a
  // virtualised grid gives it no surrounding rows to read it against.
  const summary = `Row ${number}. ${STATUS[view.status].label}. ${view.description}, ${
    view.amount
  }, ${view.date}, ${view.category}, ${view.wallet}.${
    view.reason ? ` ${view.reason}` : ''
  }`

  const shell = `border-b border-fp-border px-[14px] ${
    active ? 'bg-fp-accent-soft' : ''
  } ${row.excluded ? 'opacity-55' : ''}`

  if (compact) {
    return (
      <div
        id={id}
        role="row"
        aria-rowindex={rowIndex}
        aria-selected={active}
        aria-label={summary}
        style={{ height }}
        className={`${shell} flex items-start gap-3 py-2.5`}
      >
        <div role="gridcell" className="pt-[3px]">
          {check}
        </div>
        <div role="gridcell" className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
              {view.description}
            </span>
            {amount}
          </div>
          <span className="truncate text-[12px] text-fp-text-3">
            <span dir="ltr">{view.date}</span> · {view.category} · {view.wallet}
          </span>
          <div className="flex items-center gap-2">
            <StatusChip status={view.status} />
            {view.reason ? (
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-fp-text-3">
                {view.reason}
              </span>
            ) : null}
          </div>
        </div>
        <div role="gridcell" className="flex shrink-0 items-center gap-1">
          {view.duplicate ? <DuplicateInfo text={view.duplicate} /> : null}
          {edit}
        </div>
      </div>
    )
  }

  return (
    <div
      id={id}
      role="row"
      aria-rowindex={rowIndex}
      aria-selected={active}
      aria-label={summary}
      style={{ height }}
      className={`${REVIEW_GRID} ${shell}`}
    >
      <div role="gridcell">{check}</div>
      <div
        role="gridcell"
        dir="ltr"
        className="truncate text-[12.5px] text-fp-text-2 tabular-nums"
      >
        {view.date}
      </div>
      <div role="gridcell" className="flex min-w-0 flex-col gap-[1px]">
        <span className="truncate text-[13.5px] font-semibold">
          {view.description}
        </span>
        {view.reason ? (
          <span
            title={view.reason}
            className="truncate text-[11.5px] text-fp-text-3"
          >
            {view.reason}
          </span>
        ) : null}
      </div>
      <div role="gridcell" className="text-end">
        {amount}
      </div>
      <div role="gridcell" className="truncate text-[12.5px] text-fp-text-2">
        {view.category}
      </div>
      <div role="gridcell" className="truncate text-[12.5px] text-fp-text-2">
        {view.wallet}
      </div>
      <div role="gridcell" className="min-w-0">
        <StatusChip status={view.status} />
      </div>
      <div role="gridcell" className="flex items-center justify-end gap-1">
        {view.duplicate ? <DuplicateInfo text={view.duplicate} /> : null}
        {edit}
      </div>
    </div>
  )
}

/**
 * Memoised on purpose: a scroll moves the window by a row or two, and without this every
 * row still on screen would unmount and remount — the most expensive thing the step does.
 */
export const ReviewRow = memo(ReviewRowInner)
