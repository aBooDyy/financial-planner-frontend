import { Plus, ShoppingBasket } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { removeEveryday } from '#/features/planning/actions/everyday'
import { isPlannedBudget } from '#/features/planning/data/everyday'
import { ProgressBar } from '#/features/planning/components/kit/ProgressBar'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { money, perPeriod } from '#/features/planning/view/format'
import {
  everydayChip,
  everydayMeta,
} from '#/features/planning/view/everydayDraft'
import { useBudgetsLeft } from '#/features/wallets/hooks/useBudgetsLeft'
import { ItemRow } from './ItemRow'

/** Bills' neighbour: spending that varies, with what each estimate leaves this period. */
export function EverydayCard() {
  const { inputs, state } = usePlannedData()
  const catalog = useCategoryCatalog()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const lefts = useBudgetsLeft(inputs.base, inputs.rates)
  const leftOf = new Map(lefts.map((l) => [l.id, l]))
  const rows = inputs.budgets.filter(isPlannedBudget)
  const add = () => openSheet({ kind: 'everyday', id: null })

  if (rows.length === 0)
    return (
      <PlanCard className="flex flex-wrap items-center gap-3 border-dashed px-4 py-3">
        <span
          aria-hidden
          className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-fp-spend-soft text-fp-spend"
        >
          <ShoppingBasket size={18} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 basis-[220px]">
          <span className="block text-[13.5px] font-extrabold">
            Everyday spending
          </span>
          <span className="block text-[12.5px] leading-[1.4] text-fp-text-2">
            Groceries, fuel, eating out. Add a rough amount so your plan leaves
            room for it.
          </span>
        </span>
        <Button type="button" variant="quiet" onClick={add}>
          <Plus size={15} aria-hidden />
          Add
        </Button>
      </PlanCard>
    )

  return (
    <PlanCard label="Everyday spending" className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-3 pb-[10px]">
        <h3 className="text-[13.5px] font-extrabold">Everyday spending</h3>
        <span className="fp-sensitive text-[12px] text-fp-text-3">
          About {money(state.funding.everydayPerSlot, inputs.base)}{' '}
          {perPeriod(state.funding.calendar)}
        </span>
        <Button
          type="button"
          variant="quiet"
          onClick={add}
          className="ms-auto h-[30px] px-[10px] text-[12.5px]"
        >
          <Plus size={14} aria-hidden />
          Add
        </Button>
      </div>
      <ul>
        {rows.map((b) => {
          const cat = catalog.get(b.categoryId ?? '')
          const left = leftOf.get(b.id)
          const edit = () => openSheet({ kind: 'everyday', id: b.id })
          return (
            <ItemRow
              key={b.id}
              name={cat.name}
              color={cat.color}
              meta={everydayMeta(
                b,
                left
                  ? { amount: left.left, windowLabel: left.windowLabel }
                  : null,
              )}
              amount={
                left
                  ? money(Math.max(0, b.limit - left.left), b.currency)
                  : money(b.limit, b.currency)
              }
              amountNote={left ? 'spent' : undefined}
              chip={everydayChip(b, left?.left ?? null)}
              progress={
                left ? (
                  <ProgressBar
                    value={Math.max(0, b.limit - left.left)}
                    max={b.limit}
                    color={
                      left.left < 0 ? 'var(--fp-danger)' : 'var(--fp-spend)'
                    }
                    label={`${cat.name} spent`}
                  />
                ) : undefined
              }
              menu={[
                { label: 'Edit', onSelect: edit },
                {
                  label: 'Take out of plan',
                  destructive: true,
                  onSelect: () =>
                    void removeEveryday(b.id).then(() =>
                      toast(`${cat.name} taken out of your plan`),
                    ),
                },
              ]}
              onOpen={edit}
            />
          )
        })}
      </ul>
    </PlanCard>
  )
}
