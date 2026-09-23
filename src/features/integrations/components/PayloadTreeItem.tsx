import { ChevronRight } from 'lucide-react'
import { cn } from '#/lib/utils'
import {
  isExpandable,
  preview,
  tokenId,
} from '#/features/integrations/data/payloadTree'
import type { PayloadNode } from '#/features/integrations/data/payloadTree'

type Props = {
  node: PayloadNode
  expanded: ReadonlySet<string>
  active: string | null
  marks: ReadonlyMap<string, string[]>
  highlighted: ReadonlySet<string>
  targetLabel: string | null
  register: (id: string, el: HTMLElement | null) => void
  /** A value or one of its words was tapped. */
  onActivate: (id: string) => void
  onToggle: (path: string) => void
  onFocusItem: (id: string) => void
  onPoint: (id: string | null) => void
}

const INDENT_PX = 14

const VALUE_TONE: Record<PayloadNode['kind'], string> = {
  object: 'text-fp-text-3',
  array: 'text-fp-text-3',
  string: 'text-fp-text',
  number: 'text-fp-accent-ink',
  boolean: 'text-fp-accent-ink',
  null: 'text-fp-text-3',
}

/** One node of the payload tree, its children or its words nested inside it. */
export function PayloadTreeItem(props: Props) {
  const {
    node,
    expanded,
    active,
    marks,
    highlighted,
    targetLabel,
    register,
    onActivate,
    onToggle,
    onFocusItem,
    onPoint,
  } = props
  const open = expanded.has(node.path)
  const container = node.children.length > 0
  const expandable = isExpandable(node)
  const fills = marks.get(node.path) ?? []
  const lit = highlighted.has(node.path)
  const bindHint =
    !container && targetLabel ? `, press Enter to use for ${targetLabel}` : ''

  return (
    <div
      ref={(el) => register(node.path, el)}
      role="treeitem"
      aria-level={node.depth}
      aria-expanded={expandable ? open : undefined}
      aria-label={`${node.label}: ${preview(node)}${fills.length ? `, fills ${fills.join(', ')}` : ''}${bindHint}`}
      tabIndex={active === node.path ? 0 : -1}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onFocusItem(node.path)
      }}
      className="outline-none"
    >
      <div
        title={node.path}
        onMouseEnter={() => onPoint(node.path)}
        onClick={() =>
          container ? onToggle(node.path) : onActivate(node.path)
        }
        style={{ paddingInlineStart: 8 + (node.depth - 1) * INDENT_PX }}
        className={cn(
          'flex min-h-8 cursor-pointer flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border-s-2 border-transparent py-0.5 pe-2 hover:bg-fp-surface-2',
          '[[role=treeitem]:focus-visible>&]:ring-2 [[role=treeitem]:focus-visible>&]:ring-fp-accent [[role=treeitem]:focus-visible>&]:ring-inset',
          fills.length > 0 && 'border-fp-accent bg-fp-accent-soft',
          lit && 'ring-2 ring-fp-warn ring-inset',
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {expandable ? (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.path)
              }}
              className="flex h-4 w-4 items-center justify-center text-fp-text-3"
            >
              <ChevronRight
                size={13}
                strokeWidth={2.2}
                className={open ? 'rotate-90 transition' : 'transition'}
              />
            </button>
          ) : null}
        </span>
        <span className="shrink-0 text-fp-text-2">{node.label}</span>
        <span className="text-fp-text-3">:</span>
        <span
          className={cn(
            'min-w-[8rem] flex-1 [overflow-wrap:anywhere]',
            VALUE_TONE[node.kind],
          )}
        >
          {preview(node)}
        </span>
        {fills.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {fills.map((label) => (
              <FieldChip key={label} label={label} />
            ))}
          </span>
        ) : null}
      </div>

      {open && container ? (
        <div role="group">
          {node.children.map((child) => (
            <PayloadTreeItem key={child.path} {...props} node={child} />
          ))}
        </div>
      ) : null}

      {open && node.tokens.length > 0 ? (
        <div
          role="group"
          aria-label="Words in this value"
          style={{ paddingInlineStart: 8 + node.depth * INDENT_PX }}
          className="flex flex-wrap gap-1 pe-2 pt-0.5 pb-1.5"
        >
          {node.tokens.map((token, index) => {
            const id = tokenId(node.path, index)
            const wordFills = marks.get(id) ?? []
            return (
              <span
                key={id}
                ref={(el) => register(id, el)}
                role="treeitem"
                aria-level={node.depth + 1}
                aria-label={`${token.text}${wordFills.length ? `, fills ${wordFills.join(', ')}` : ''}${targetLabel ? `, press Enter to use for ${targetLabel}` : ''}`}
                tabIndex={active === id ? 0 : -1}
                title={`${node.path} · “${token.text}”`}
                onFocus={(e) => {
                  e.stopPropagation()
                  onFocusItem(id)
                }}
                onMouseEnter={() => onPoint(id)}
                onClick={(e) => {
                  e.stopPropagation()
                  onActivate(id)
                }}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 outline-none hover:border-fp-accent hover:bg-fp-accent-soft focus-visible:ring-2 focus-visible:ring-fp-accent',
                  wordFills.length > 0
                    ? 'border-fp-accent bg-fp-accent-soft'
                    : 'border-fp-border bg-fp-surface-2',
                )}
              >
                {token.text}
                {wordFills.map((label) => (
                  <FieldChip key={label} label={label} />
                ))}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function FieldChip({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-fp-accent bg-fp-surface px-1.5 py-px font-sans text-[10px] leading-4 font-bold text-fp-accent-ink">
      {label}
    </span>
  )
}
