import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { ROW_KINDS, hasFlow } from '#/features/import/data/rowEditForm'
import type { RowKind } from '#/features/import/data/rowEditForm'
import type { TxType } from '#/features/transactions/api/types'

type Props = {
  kind: RowKind
  flow: TxType
  onKind: (kind: RowKind) => void
  onFlow: (flow: TxType) => void
}

/**
 * What the row is. Spending and income carry their direction in the name; a transfer and an
 * adjustment move money either way, so they ask for it underneath.
 */
export function RowKindField({ kind, flow, onKind, onFlow }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <FieldLabel>What is it?</FieldLabel>
        <PillSwitch<RowKind>
          label="What this row is"
          options={ROW_KINDS}
          value={kind}
          onChange={onKind}
        />
      </div>

      {hasFlow(kind) ? (
        <PillSwitch<TxType>
          label="Money in or out"
          options={[
            {
              value: 'spend',
              label: kind === 'transfer' ? 'Out of this account' : 'Money out',
            },
            {
              value: 'income',
              label: kind === 'transfer' ? 'Into this account' : 'Money in',
            },
          ]}
          value={flow}
          onChange={onFlow}
        />
      ) : null}
    </div>
  )
}
