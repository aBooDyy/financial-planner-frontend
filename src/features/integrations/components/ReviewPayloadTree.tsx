import { useMemo } from 'react'
import type { PayloadViewProps } from '#/features/inbound-imports/components/payloadView'
import { buildTree } from '#/features/integrations/data/payloadTree'
import { PayloadTree } from './PayloadTree'

const NO_MARKS: ReadonlyMap<string, string[]> = new Map()
const NOTHING_LIT: ReadonlySet<string> = new Set()
const IGNORE_TAPS = () => {}

/**
 * The payload tree as the queue shows a stored webhook body: the same tree the rule editor
 * binds paths with, read-only.
 */
export function ReviewPayloadTree({ payload }: PayloadViewProps) {
  const root = useMemo(() => buildTree(payload), [payload])
  return (
    <PayloadTree
      root={root}
      onBind={IGNORE_TAPS}
      marks={NO_MARKS}
      highlighted={NOTHING_LIT}
      targetLabel={null}
      label="Payload"
      explainWords={false}
    />
  )
}
