import { Label } from '#/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { ROW_KINDS, hasFlow } from '#/features/import/data/rowEditForm'
import type { RowKind } from '#/features/import/data/rowEditForm'
import type { TxType } from '#/features/transactions/api/types'

type Props = {
  kind: RowKind
  flow: TxType
  onKind: (kind: RowKind) => void
  onFlow: (flow: TxType) => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const TRACK = 'w-full rounded-xl bg-fp-surface-2 p-1'
const ITEM = 'flex-1 rounded-[9px]'

/**
 * What the row is. Spending and income carry their direction in the name; a transfer and an
 * adjustment move money either way, so they ask for it underneath.
 */
export function RowKindField({ kind, flow, onKind, onFlow }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label className={LABEL}>Direction</Label>
        <ToggleGroup
          type="single"
          value={kind}
          spacing={1}
          aria-label="What this row is"
          className={`${TRACK} flex-wrap`}
          onValueChange={(value) => {
            if (value) onKind(value as RowKind)
          }}
        >
          {ROW_KINDS.map((entry) => (
            <ToggleGroupItem
              key={entry.value}
              value={entry.value}
              className={ITEM}
            >
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {hasFlow(kind) ? (
        <ToggleGroup
          type="single"
          value={flow}
          spacing={1}
          aria-label="Money in or out"
          className={TRACK}
          onValueChange={(value) => {
            if (value) onFlow(value as TxType)
          }}
        >
          <ToggleGroupItem value="spend" className={ITEM}>
            {kind === 'transfer' ? 'Out of this account' : 'Money out'}
          </ToggleGroupItem>
          <ToggleGroupItem value="income" className={ITEM}>
            {kind === 'transfer' ? 'Into this account' : 'Money in'}
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
    </div>
  )
}
