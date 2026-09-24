import { ArrowDownLeft, CalendarClock, Target } from 'lucide-react'
import type { PlannedRowView, PlannedTag } from '#/features/planned/data/views'
import { TagPill } from '#/components/TagPill'
import type { TagTone } from '#/components/TagPill'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const TAG_TONE: Record<PlannedTag, TagTone> = {
  goal: 'accent',
  income: 'accent',
  obligation: 'neutral',
}

const TAG_ICON = {
  goal: Target,
  income: ArrowDownLeft,
  obligation: CalendarClock,
} satisfies Record<PlannedTag, unknown>

type Props = {
  row: PlannedRowView
  color: string
  /** Due rows are live (actions, full colour); upcoming ones are muted. */
  muted?: boolean
  busy?: boolean
  onOpen: () => void
  onConfirm?: () => void
  onSkip?: () => void
}

/** One planned item: dashed origin-coloured icon, name + tag, meta, amount, Skip / Confirm. */
export function PlannedRow({
  row,
  color,
  muted,
  busy,
  onOpen,
  onConfirm,
  onSkip,
}: Props) {
  const Icon = TAG_ICON[row.tag]
  const sign = row.direction === 'in' ? '+' : '−'
  const actions = !muted && onConfirm

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fp-border px-4 py-[11px] last:border-b-0 hover:bg-fp-surface-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${row.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span
          className="flex size-[34px] flex-none items-center justify-center rounded-[10px] border-[1.5px] border-dashed bg-transparent opacity-90"
          style={{ borderColor: color, color }}
        >
          <Icon size={17} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex min-w-0 items-center gap-[7px]">
            <span
              className={cn(
                'truncate text-[14px] font-semibold',
                muted ? 'text-fp-text-2' : 'text-fp-text',
              )}
            >
              {row.name}
            </span>
            <TagPill
              label={row.tagLabel}
              tone={TAG_TONE[row.tag]}
              dashed={muted}
            />
          </span>
          <span
            className={cn(
              'truncate text-[12px]',
              row.isDue && !muted ? 'text-fp-warn' : 'text-fp-text-3',
            )}
          >
            {row.metaStr}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end text-end">
          <span
            className={cn(
              'whitespace-nowrap text-[14.5px] font-bold tabular-nums',
              muted
                ? 'text-fp-text-2'
                : row.direction === 'in'
                  ? 'text-fp-accent'
                  : 'text-fp-text',
            )}
          >
            {sign}
            {row.amountStr}
          </span>
          {row.ofStr ? (
            <span className="text-[11px] text-fp-text-3 tabular-nums">
              {row.ofStr}
            </span>
          ) : null}
        </span>
      </button>
      {actions ? (
        <div className="flex w-full flex-none justify-end gap-2 md:w-auto">
          {onSkip ? (
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="rounded-[9px] border border-fp-border-strong bg-fp-surface px-[10px] py-[7px] text-[12px] font-bold text-fp-text-2 hover:text-fp-text disabled:opacity-60"
            >
              Skip
            </button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-[9px] text-[12px]"
          >
            {row.direction === 'in' ? 'Confirm received' : 'Confirm'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
