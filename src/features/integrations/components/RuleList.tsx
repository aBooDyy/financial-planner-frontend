import { useState } from 'react'
import type { RuleDraft } from '#/features/integrations/data/ruleDraft'
import type { RuleVerdict } from '#/features/integrations/data/verdicts'
import { useDragReorder } from '#/features/integrations/hooks/useDragReorder'
import { RuleListItem } from './RuleListItem'

type Props = {
  rules: RuleDraft[]
  verdicts: RuleVerdict[]
  /** Positions with a problem the last save or test reported. */
  flagged: ReadonlySet<number>
  disabled: boolean
  onOpen: (index: number) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
}

/**
 * The key's rules in the order they are checked. Order is the semantics, so it is physical:
 * drag a handle, or focus it and use the arrow keys. Each move is announced.
 */
export function RuleList({
  rules,
  verdicts,
  flagged,
  disabled,
  onOpen,
  onRemove,
  onMove,
}: Props) {
  const [announcement, setAnnouncement] = useState('')
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rules.length || from === to) return
    onMove(from, to)
    setAnnouncement(
      `Moved “${rules[from].name}” to position ${to + 1} of ${rules.length}.`,
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
          <RuleListItem
            key={rule.key}
            rule={rule}
            index={index}
            count={rules.length}
            verdict={verdicts[index] ?? 'unreached'}
            flagged={flagged.has(index)}
            dragging={dragging === index}
            disabled={disabled}
            handleProps={handleProps(index)}
            onMove={(to) => move(index, to)}
            onOpen={() => onOpen(index)}
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
