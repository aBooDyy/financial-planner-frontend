import { Plus } from 'lucide-react'
import type { GoalsView } from '#/features/goals/data/selectors'
import { Button } from '#/components/ui/button'
import { IncomeRow } from './IncomeRow'

type Props = {
  view: GoalsView
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function IncomeCard({ view, onAdd, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Income</span>
          <span className="text-[12px] text-fp-text-3">
            {view.incomeStr}/mo · normalized from every stream
          </span>
        </div>
        <Button
          variant="outline"
          onClick={onAdd}
          className="gap-[5px] px-[13px] py-[9px] text-[13px] font-semibold hover:border-fp-accent"
        >
          <Plus size={15} strokeWidth={2} />
          Add income
        </Button>
      </div>

      {view.incomeRows.length > 0 ? (
        <div>
          {view.incomeRows.map((row) => (
            <IncomeRow
              key={row.id}
              row={row}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-[13px] text-fp-text-3">
          Add your income streams so the plan knows what there is to work with.
        </div>
      )}
    </div>
  )
}
