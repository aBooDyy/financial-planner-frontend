import { Wallet } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { GoalsView } from '#/features/goals/data/selectors'
import { IncomeRow } from './IncomeRow'
import { SectionHeader } from './SectionHeader'
import { SURFACE_CARD } from './styles'

type Props = {
  view: GoalsView
  selectedId: string | null
  onAdd: () => void
  onSelect: (id: string) => void
}

export function IncomeSection({ view, selectedId, onAdd, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-[14px]">
      <SectionHeader
        title="Income"
        sub={`${view.incomeStr}/mo · normalized from every stream`}
        actionLabel="Add income"
        onAction={onAdd}
      />

      {view.incomeRows.length > 0 ? (
        <div className={`overflow-hidden ${SURFACE_CARD}`}>
          {view.incomeRows.map((row) => (
            <IncomeRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Wallet}
          title="No income yet"
          text="Add your income streams so the plan knows what there is to work with."
          framed
          action={{ label: 'Add income', onClick: onAdd }}
        />
      )}
    </div>
  )
}
