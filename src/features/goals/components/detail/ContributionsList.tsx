import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { GoalDetailView } from '#/features/goals/data/goalDetail'
import { Button } from '#/components/ui/button'
import { FIELD_LABEL_TEXT } from '../styles'
import { ContributionMark } from './ContributionMark'
import { ContributionRow } from './ContributionRow'

type Props = {
  detail: GoalDetailView
  color: string
  onAdd: () => void
  onConfirm: (plannedId: string) => void
  onRemoveAllocation: (allocationId: string) => void
}

/** Settlements and planned items, date-ordered, with "+ Add contribution". */
export function ContributionsList({
  detail,
  color,
  onAdd,
  onConfirm,
  onRemoveAllocation,
}: Props) {
  const [showEarlier, setShowEarlier] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const rows = showEarlier
    ? detail.contributions
    : detail.contributions.slice(detail.earlierCount)
  const hidden = detail.contributions.length - rows.length

  return (
    <div>
      <div className="mb-[6px] flex items-center justify-between">
        <span className={FIELD_LABEL_TEXT}>Contributions</span>
        <Button
          variant="outline"
          onClick={onAdd}
          className="h-auto gap-1 rounded-[8px] bg-fp-surface-2 px-[9px] py-[5px] text-[11.5px] font-bold hover:border-fp-accent"
        >
          <Plus size={13} strokeWidth={2.4} />
          Add contribution
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[11px] border border-dashed border-fp-border-strong px-3 py-3 text-[12px] leading-normal text-fp-text-3">
          Nothing yet. Planned set-asides and payments show up here, and so does
          anything you add.
        </p>
      ) : (
        <div className="flex flex-col">
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowEarlier(true)}
              className="border-b border-fp-border py-[7px] text-start text-[11.5px] font-semibold text-fp-text-2 hover:text-fp-text"
            >
              Show {hidden} earlier
            </button>
          ) : null}
          {rows.map((row) => {
            const allocationId = row.allocationId
            const onSelect = row.plannedId
              ? () => onConfirm(row.plannedId ?? '')
              : allocationId
                ? () => setOpenKey((k) => (k === row.key ? null : row.key))
                : undefined
            return (
              <div key={row.key}>
                <ContributionRow row={row} color={color} onSelect={onSelect} />
                {allocationId && openKey === row.key ? (
                  <div className="flex items-center justify-between gap-2 border-b border-fp-border bg-fp-surface-2 px-2 py-[7px] text-[11.5px] text-fp-text-2">
                    <span>Set aside, still in its wallet.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenKey(null)
                        onRemoveAllocation(allocationId)
                      }}
                      className="font-bold text-fp-danger hover:underline"
                    >
                      Take it back
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fp-text-3">
        <span className="inline-flex items-center gap-[5px]">
          <ContributionMark mark="confirmed" color={color} size={8} />
          confirmed
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <ContributionMark mark="due" color={color} size={8} />
          needs confirming
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <ContributionMark mark="future" color={color} size={8} />
          planned
        </span>
      </div>
    </div>
  )
}
