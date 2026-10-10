import type { HTMLAttributes } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import {
  describeFields,
  describeMatch,
  describeTextFilter,
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
    className: 'bg-fp-accent-soft text-fp-accent-ink',
  },
  skipped: {
    text: 'Doesn’t match',
    className: 'bg-fp-surface-2 text-fp-text-2',
  },
}

const ICON_BUTTON =
  'flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-fp-border text-fp-text-3 transition hover:border-fp-border-strong hover:text-fp-text disabled:opacity-40'

/** One rule, summarised from itself: what it takes in words and what it reads. */
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
        'flex items-start gap-[10px] rounded-[14px] border-[1.5px] bg-fp-surface p-3 transition-shadow',
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
        className="-ms-1 flex h-[22px] w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-fp-text-3 hover:text-fp-text focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:outline-none active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical size={15} strokeWidth={2} />
      </button>
      <span className="pt-px text-[13px] font-extrabold text-fp-text-3 tabular-nums">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[14px] font-extrabold">
            {rule.name}
          </span>
          {badge ? (
            <span
              className={cn(
                'rounded-full px-2 py-[2px] text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap',
                badge.className,
              )}
            >
              {badge.text}
            </span>
          ) : null}
          {flagged ? (
            <span className="rounded-full bg-fp-danger/10 px-2 py-[2px] text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap text-fp-danger">
              Needs a fix
            </span>
          ) : null}
        </div>
        <span className="mt-[3px] text-[12.5px] text-fp-text-2">
          {rule.text ? (
            describeTextFilter(rule.text.filter, rule.text.textPath)
          ) : match ? (
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
        <span className="mt-[2px] text-[12.5px] text-fp-text-3">
          {describeFields(rule)}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Edit “${rule.name}”`}
        disabled={disabled}
        onClick={onOpen}
        className={ICON_BUTTON}
      >
        <Pencil size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={`Delete “${rule.name}”`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(ICON_BUTTON, 'hover:text-fp-danger')}
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </li>
  )
}
