import type { HTMLAttributes } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import {
  describeFields,
  describeMatch,
} from '#/features/integrations/data/ruleDraft'
import type { RuleDraft } from '#/features/integrations/data/ruleDraft'
import type { RuleVerdict } from '#/features/integrations/data/verdicts'

type Props = {
  rule: RuleDraft
  index: number
  count: number
  verdict: RuleVerdict
  flagged: boolean
  dragging: boolean
  disabled: boolean
  handleProps: HTMLAttributes<HTMLElement>
  onMove: (to: number) => void
  onOpen: () => void
  onRemove: () => void
}

const VERDICT: Partial<
  Record<RuleVerdict, { text: string; className: string }>
> = {
  fires: {
    text: 'Handles the sample',
    className: 'border-fp-accent/50 bg-fp-accent-soft text-fp-accent-ink',
  },
  skipped: {
    text: 'Doesn’t match',
    className: 'border-fp-border text-fp-text-3',
  },
}

/** One rule, summarised from itself: its condition in words and the fields it reads. */
export function RuleListItem({
  rule,
  index,
  count,
  verdict,
  flagged,
  dragging,
  disabled,
  handleProps,
  onMove,
  onOpen,
  onRemove,
}: Props) {
  const match = describeMatch(rule.match)
  const badge = VERDICT[verdict]

  return (
    <li
      data-reorder-item
      className={cn(
        'flex items-start gap-2 rounded-xl border bg-fp-surface p-2.5 transition-shadow',
        dragging ? 'border-fp-accent shadow-fp' : 'border-fp-border',
      )}
    >
      <button
        type="button"
        data-vaul-no-drag
        disabled={disabled || count < 2}
        aria-label={`Reorder “${rule.name}”, position ${index + 1} of ${count}. Use the up and down arrow keys to move it.`}
        {...handleProps}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onMove(index - 1)
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            onMove(index + 1)
          }
        }}
        className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:outline-none active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical size={16} strokeWidth={2} />
      </button>
      <span className="mt-2 w-5 shrink-0 text-center text-[12.5px] font-bold text-fp-text-3 tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[14px] font-bold">{rule.name}</span>
          {badge ? (
            <span
              className={cn(
                'rounded-full border px-2 py-px text-[11px] font-semibold',
                badge.className,
              )}
            >
              {badge.text}
            </span>
          ) : null}
          {flagged ? (
            <span className="rounded-full border border-fp-danger/50 px-2 py-px text-[11px] font-semibold text-fp-danger">
              Needs a fix
            </span>
          ) : null}
        </div>
        <span className="text-[12.5px] text-fp-text-2">
          {match ? (
            <>
              When{' '}
              <bdi dir="ltr" className="font-mono text-[12px]">
                {match.path}
              </bdi>{' '}
              {match.relation}
              {match.value !== null ? (
                <>
                  {' '}
                  “<bdi>{match.value}</bdi>”
                </>
              ) : null}
            </>
          ) : (
            'Always matches'
          )}
        </span>
        <span className="text-[12px] text-fp-text-3">
          {describeFields(rule)}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Edit “${rule.name}”`}
        disabled={disabled}
        onClick={onOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fp-text-2 hover:bg-fp-surface-2 hover:text-fp-text disabled:opacity-40"
      >
        <Pencil size={15} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={`Delete “${rule.name}”`}
        disabled={disabled}
        onClick={onRemove}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fp-text-2 hover:bg-fp-surface-2 hover:text-fp-danger disabled:opacity-40"
      >
        <Trash2 size={15} strokeWidth={2} />
      </button>
    </li>
  )
}
