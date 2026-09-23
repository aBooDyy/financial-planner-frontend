import { useMemo } from 'react'
import type { PayloadViewProps } from '#/features/inbound-imports/components/payloadView'
import type { PickField } from '#/features/inbound-imports/data/pickValues'
import { pickLabel } from '#/features/inbound-imports/data/pickValues'
import { buildTree } from '#/features/integrations/data/payloadTree'
import type { Binding } from '#/features/integrations/data/ruleDraft'
import { nameRun } from '#/features/integrations/data/tokens'
import { PayloadTree } from './PayloadTree'

const NO_MARKS: ReadonlyMap<string, string[]> = new Map()
const NOTHING_LIT: ReadonlySet<string> = new Set()

/** Fields whose value may run over several words, so a tapped word grows into its name. */
const NAMES: ReadonlySet<PickField> = new Set(['merchant', 'note'])

function pickedText(binding: Binding, target: PickField | null): string {
  const { piece, value } = binding
  if (piece && typeof value === 'string') {
    const [first, last] =
      target && NAMES.has(target)
        ? nameRun(piece.tokens, piece.index)
        : [piece.index, piece.index]
    return value.slice(piece.tokens[first].start, piece.tokens[last].end)
  }
  if (value === null || typeof value === 'object') return ''
  return String(value)
}

/**
 * The payload tree as the review queue shows a staged webhook row: the same tree the rule
 * editor binds paths with, except that a tap hands the tapped value to the review form.
 */
export function ReviewPayloadTree({
  payload,
  target,
  onPick,
}: PayloadViewProps) {
  const root = useMemo(() => buildTree(payload), [payload])

  const bind = (binding: Binding) => {
    if (!onPick) return
    const text = pickedText(binding, target)
    onPick({ value: binding.piece ? text : binding.value, text })
  }

  return (
    <PayloadTree
      root={root}
      onBind={bind}
      marks={NO_MARKS}
      highlighted={NOTHING_LIT}
      targetLabel={onPick && target ? pickLabel(target) : null}
      label="Payload"
      explainWords={false}
    />
  )
}
