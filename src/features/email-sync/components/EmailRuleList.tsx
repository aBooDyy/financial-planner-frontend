import { useState } from 'react'
import { fallbackName } from '#/features/email-sync/data/ruleDraft'
import type { RuleDraft } from '#/features/email-sync/data/ruleDraft'
import { useDragReorder } from '#/hooks/useDragReorder'
import { EmailRuleListItem } from './EmailRuleListItem'

type Props = {
  rules: RuleDraft[]
  walletNames: ReadonlyMap<string, string>
  /** Recent emails each rule handles, by position; null before a test has run. */
  handled: number[] | null
  /** Positions with a problem the last save reported. */
  flagged: ReadonlySet<number>
  disabled: boolean
  onOpen: (index: number) => void
  onToggle: (index: number) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
}

/**
 * The inbox's rules in the order they are checked. Order is the semantics, so it is physical:
 * drag a handle, or focus it and use the arrow keys. Each move is announced.
 */
export function EmailRuleList({
  rules,
  walletNames,
  handled,
  flagged,
  disabled,
  onOpen,
  onToggle,
  onRemove,
  onMove,
}: Props) {
  const [announcement, setAnnouncement] = useState('')
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rules.length || from === to) return
    onMove(from, to)
    setAnnouncement(
      `Moved “${fallbackName(rules[from])}” to position ${to + 1} of ${rules.length}.`,
    )
  }
  const { listRef, dragging, handleProps } = useDragReorder(move)

  return (
    <>
      <ol
        ref={listRef}
        aria-label="Rules, checked in order"
        className="flex flex-col gap-2"
      >
        {rules.map((rule, index) => (
          <EmailRuleListItem
            key={rule.key}
            rule={rule}
            index={index}
            count={rules.length}
            walletName={
              rule.walletId ? (walletNames.get(rule.walletId) ?? null) : null
            }
            handled={handled ? (handled[index] ?? 0) : null}
            flagged={flagged.has(index)}
            dragging={dragging === index}
            disabled={disabled}
            handleProps={handleProps(index)}
            onMove={(to) => move(index, to)}
            onOpen={() => onOpen(index)}
            onToggle={() => onToggle(index)}
            onRemove={() => onRemove(index)}
          />
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}
