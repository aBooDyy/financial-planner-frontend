import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  indexTree,
  initiallyExpanded,
  isExpandable,
  parseTokenId,
  tokenId,
  visibleIds,
} from '#/features/integrations/data/payloadTree'
import type { PayloadNode } from '#/features/integrations/data/payloadTree'
import type { Binding } from '#/features/integrations/data/ruleDraft'
import { PayloadTreeItem } from './PayloadTreeItem'

type Props = {
  root: PayloadNode
  onBind: (binding: Binding) => void
  /** Labels of the fields each path currently fills. */
  marks: ReadonlyMap<string, string[]>
  highlighted: ReadonlySet<string>
  /** What a tap fills right now, for the hint and the accessible name. */
  targetLabel: string | null
  label: string
  /**
   * Whether the path line explains that a word is read with a pattern — true in the rule
   * editor, where a tapped word becomes one; false where a tap only copies the word.
   */
  explainWords?: boolean
}

/**
 * A pasted payload as a collapsible tree. Tapping a value — or one word inside a longer
 * string — binds it to the field being filled. It is a WAI-ARIA tree: arrows move and
 * open/close, Home/End jump, Enter or Space binds, so the gesture has a keyboard equivalent.
 * Paths are technical text, so the tree is an LTR island in either page direction.
 */
export function PayloadTree({
  root,
  onBind,
  marks,
  highlighted,
  targetLabel,
  label,
  explainWords = true,
}: Props) {
  const nodes = useMemo(() => indexTree(root), [root])
  const [expanded, setExpanded] = useState(() => initiallyExpanded(root))
  const ids = useMemo(() => visibleIds(root, expanded), [root, expanded])
  const [focused, setFocused] = useState<string | null>(ids[0] ?? null)
  const [pointed, setPointed] = useState<string | null>(null)
  const items = useRef(new Map<string, HTMLElement>())
  const moved = useRef(false)

  const active: string | undefined =
    focused !== null && ids.includes(focused) ? focused : ids.at(0)

  useEffect(() => {
    if (!moved.current || !active) return
    moved.current = false
    items.current.get(active)?.focus()
  }, [active])

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) items.current.set(id, el)
    else items.current.delete(id)
  }, [])

  const toggle = (path: string, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(current)
      const opening = open ?? !next.has(path)
      if (opening) next.add(path)
      else next.delete(path)
      return next
    })

  const bindId = (id: string) => {
    const piece = parseTokenId(id)
    if (piece && !nodes.has(id)) {
      const node = nodes.get(piece.path)
      if (!node) return
      onBind({
        path: node.path,
        value: node.value,
        piece: { tokens: node.tokens, index: piece.index },
      })
      return
    }
    const node = nodes.get(id)
    if (!node) return
    if (node.children.length > 0) toggle(node.path)
    else onBind({ path: node.path, value: node.value })
  }

  const focusId = (id: string | undefined) => {
    if (!id) return
    moved.current = true
    setFocused(id)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return
    const at = ids.indexOf(active)
    const node = nodes.get(active)
    const piece = node ? null : parseTokenId(active)
    const handled = () => {
      event.preventDefault()
      event.stopPropagation()
    }
    switch (event.key) {
      case 'ArrowDown':
        handled()
        focusId(ids[Math.min(at + 1, ids.length - 1)])
        break
      case 'ArrowUp':
        handled()
        focusId(ids[Math.max(at - 1, 0)])
        break
      case 'Home':
        handled()
        focusId(ids[0])
        break
      case 'End':
        handled()
        focusId(ids[ids.length - 1])
        break
      case 'ArrowRight':
        handled()
        if (node && isExpandable(node)) {
          if (!expanded.has(node.path)) toggle(node.path, true)
          else
            focusId(
              node.children[0]?.path ??
                (node.tokens.length > 0 ? tokenId(node.path, 0) : undefined),
            )
        }
        break
      case 'ArrowLeft':
        handled()
        if (node && isExpandable(node) && expanded.has(node.path)) {
          toggle(node.path, false)
        } else if (piece) {
          focusId(piece.path)
        } else if (node?.parent && node.parent !== root.path) {
          focusId(node.parent)
        }
        break
      case 'Enter':
      case ' ':
        handled()
        bindId(active)
        break
    }
  }

  const shownPath = pointed ?? active
  const shownPiece = shownPath ? parseTokenId(shownPath) : null
  const pathText =
    shownPath && !nodes.has(shownPath) && shownPiece
      ? explainWords
        ? `${shownPiece.path} · one word, read with a pattern`
        : shownPiece.path
      : shownPath

  return (
    <div className="flex flex-col gap-2">
      <div
        role="tree"
        aria-label={label}
        dir="ltr"
        onKeyDown={onKeyDown}
        onMouseLeave={() => setPointed(null)}
        className="max-h-[42vh] overflow-auto rounded-xl border border-fp-border bg-fp-surface py-1.5 text-start font-mono text-[12.5px] md:max-h-[380px]"
      >
        {root.children.map((child) => (
          <PayloadTreeItem
            key={child.path}
            node={child}
            expanded={expanded}
            active={active ?? null}
            marks={marks}
            highlighted={highlighted}
            targetLabel={targetLabel}
            register={register}
            onActivate={(id) => {
              setFocused(id)
              bindId(id)
            }}
            onToggle={(path) => {
              setFocused(path)
              toggle(path)
            }}
            onFocusItem={setFocused}
            onPoint={setPointed}
          />
        ))}
      </div>
      <p className="min-h-[1.25rem] text-[11.5px] text-fp-text-3">
        {pathText ? (
          <bdi dir="ltr" className="font-mono">
            {pathText}
          </bdi>
        ) : null}
      </p>
    </div>
  )
}
