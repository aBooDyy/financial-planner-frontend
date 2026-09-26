import { PiggyBank, Plus } from 'lucide-react'
import { useState } from 'react'
import type { GoalDetailView } from '#/features/goals/data/goalDetail'
import { EmptyState } from '#/components/EmptyState'
import { Button } from '#/components/ui/button'
import { CAPS_LABEL, PANE_BUTTON } from '../styles'
import { ContributionLegend } from './ContributionLegend'
import { ContributionRow } from './ContributionRow'

type Props = {
  detail: GoalDetailView
  color: string
  onAdd: () => void
  onConfirm: (plannedId: string) => void
  onRemoveAllocation: (allocationId: string) => void
}

/** Planned items and settlements, latest first, with "+ Add contribution". */
export function ContributionsList({
  detail,
  color,
  onAdd,
  onConfirm,
  onRemoveAllocation,
}: Props) {
  const [showEarlier, setShowEarlier] = useState(false)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const shown = showEarlier
    ? detail.contributions
    : detail.contributions.slice(detail.earlierCount)
  const hidden = detail.contributions.length - shown.length
  const rows = [...shown].reverse()

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={CAPS_LABEL}>Contributions</span>
        <Button
          variant="ghost"
          onClick={onAdd}
          className={`${PANE_BUTTON} gap-1 bg-fp-accent-soft text-fp-accent-ink hover:bg-fp-accent-soft hover:text-fp-accent-ink hover:brightness-95`}
        >
          <Plus size={14} strokeWidth={2.4} />
          Add contribution
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          size="sm"
          framed
          title="No contributions yet"
          text="Planned set-asides and payments show up here, and so does anything you add."
        />
      ) : (
        rows.map((row) => {
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
                <div className="mb-2 flex items-center justify-between gap-2 rounded-[10px] bg-fp-surface-2 px-3 py-2 text-[12px] text-fp-text-2">
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
        })
      )}

      {rows.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-fp-border pt-2">
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowEarlier(true)}
              className="text-[12.5px] font-bold text-fp-accent-ink hover:underline"
            >
              Show {hidden} earlier
            </button>
          ) : (
            <span />
          )}
          <ContributionLegend color={color} />
        </div>
      ) : null}
    </div>
  )
}
