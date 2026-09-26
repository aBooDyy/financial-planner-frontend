import type { HTMLAttributes } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Switch } from '#/components/ui/switch'
import {
  describeFilter,
  describeTemplate,
  fallbackName,
} from '#/features/email-sync/data/ruleDraft'
import type { RuleDraft } from '#/features/email-sync/data/ruleDraft'
import { cn } from '#/lib/utils'

type Props = {
  rule: RuleDraft
  index: number
  count: number
  walletName: string | null
  /** Recent emails this rule handles, when a test has run. */
  handled: number | null
  flagged: boolean
  dragging: boolean
  disabled: boolean
  handleProps: HTMLAttributes<HTMLElement>
  onMove: (to: number) => void
  onOpen: () => void
  onToggle: () => void
  onRemove: () => void
}

/** One rule, summarised from itself: which emails, what it reads, where they go. */
export function EmailRuleListItem({
  rule,
  index,
  count,
  walletName,
  handled,
  flagged,
  dragging,
  disabled,
  handleProps,
  onMove,
  onOpen,
  onToggle,
  onRemove,
}: Props) {
  const name = fallbackName(rule)
  const destination = [
    rule.type === 'income' ? 'Income' : 'Spend',
    walletName ?? 'account chosen when reviewing',
    rule.autoConfirm ? 'posts without review' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      data-reorder-item
      className={cn(
        'flex items-start gap-[10px] rounded-[14px] border-[1.5px] bg-fp-surface p-3 transition-shadow',
        dragging ? 'border-fp-accent shadow-fp' : 'border-fp-border',
        !rule.enabled && 'opacity-70',
      )}
    >
      <button
        type="button"
        data-vaul-no-drag
        disabled={disabled || count < 2}
        aria-label={`Reorder “${name}”, position ${index + 1} of ${count}. Use the up and down arrow keys to move it.`}
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
        className="-ms-1 flex h-[30px] w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:outline-none active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical size={15} strokeWidth={2} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-extrabold">{name}</span>
          {flagged ? <Badge tone="danger">Needs a fix</Badge> : null}
          {!rule.enabled ? (
            <Badge tone="neutral">Paused</Badge>
          ) : handled !== null ? (
            <Badge tone={handled > 0 ? 'accent' : 'neutral'}>
              {handled === 0
                ? 'No recent matches'
                : `${handled} recent ${handled === 1 ? 'match' : 'matches'}`}
            </Badge>
          ) : null}
        </div>
        <span className="mt-[3px] text-[12.5px] leading-[1.45] [overflow-wrap:anywhere] text-fp-text-2">
          <bdi>{describeFilter(rule.filter)}</bdi>
        </span>
        <span className="mt-0.5 text-[12.5px] leading-[1.45] text-fp-text-3">
          {describeTemplate(rule.template)} → <bdi>{destination}</bdi>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label={`${rule.enabled ? 'Pause' : 'Resume'} “${name}”`}
        />
        <button
          type="button"
          aria-label={`Edit “${name}”`}
          disabled={disabled}
          onClick={onOpen}
          className={ICON_BUTTON}
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={`Delete “${name}”`}
          disabled={disabled}
          onClick={onRemove}
          className={cn(ICON_BUTTON, 'hover:text-fp-danger')}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </li>
  )
}

const ICON_BUTTON =
  'flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-fp-border text-fp-text-3 transition hover:border-fp-border-strong hover:text-fp-text disabled:opacity-40'

const BADGE = {
  accent: 'bg-fp-accent-soft text-fp-accent-ink',
  danger: 'bg-fp-danger/10 text-fp-danger',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

function Badge({
  tone,
  children,
}: {
  tone: keyof typeof BADGE
  children: string
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap',
        BADGE[tone],
      )}
    >
      {children}
    </span>
  )
}
