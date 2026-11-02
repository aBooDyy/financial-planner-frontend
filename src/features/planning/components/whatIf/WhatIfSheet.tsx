import { FlaskConical, Plus, ReceiptText, ShoppingBasket, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { Switch } from '#/components/ui/switch'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { addTryoutToPlan } from '#/features/planning/actions/addTryout'
import type { WhatIfItem } from '#/features/planning/data/whatIf'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { useWhatIfResult } from '#/features/planning/hooks/useWhatIfResult'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { useWhatIf } from '#/features/planning/stores/whatIf'
import { plural } from '#/features/planning/view/format'
import {
  tryoutColor,
  tryoutLine,
  tryoutName,
  tryoutProblem,
} from '#/features/planning/view/whatIf'
import { ItemMenu } from '#/features/planning/components/kit/ItemMenu'
import { Spine } from '#/features/planning/components/kit/Spine'
import { StatusChip } from '#/features/planning/components/kit/StatusChip'
import { WhatIfOutcome } from './WhatIfOutcome'

const TRY: ReadonlyArray<{
  kind: WhatIfItem['kind']
  label: string
  icon: LucideIcon
}> = [
  { kind: 'bill', label: 'A bill', icon: ReceiptText },
  { kind: 'goal', label: 'A goal', icon: Target },
  { kind: 'everyday', label: 'Everyday spending', icon: ShoppingBasket },
]

/** What if: try bills, goals and everyday spending against the plan without adding them. */
export function WhatIfSheet({ onClose }: { onClose: () => void }) {
  return usePlanningReady() ? <WhatIfBody onClose={onClose} /> : null
}

function WhatIfBody({ onClose }: { onClose: () => void }) {
  const { inputs, state } = usePlannedData()
  const catalog = useCategoryCatalog()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const { items, toggle, remove, clear } = useWhatIf()
  const result = useWhatIfResult()
  const calendar = state.funding.calendar
  const nameOf = (item: WhatIfItem) =>
    tryoutName(item, (id) => catalog.get(id).name)
  const on = items.filter((i) => i.on)

  const addOne = async (item: WhatIfItem) => {
    await addTryoutToPlan(item)
    toast(`${nameOf(item)} added to your plan`)
  }
  const addAll = async () => {
    for (const item of on) await addTryoutToPlan(item)
    toast(`${plural(on.length, 'item')} added to your plan`)
    onClose()
  }
  const open = (kind: WhatIfItem['kind'], itemId: string | null) =>
    openSheet({ kind, id: null, trial: { itemId } })

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="What if…"
      description="Try something against your plan. Nothing changes until you add it."
      footer={
        items.length > 0 ? (
          <DialogActions
            onDelete={clear}
            deleteLabel="Clear"
            onCancel={onClose}
            cancelLabel="Close"
            submitLabel={
              on.length === 1
                ? 'Add it to my plan'
                : `Add ${on.length} to my plan`
            }
            disabled={on.length === 0}
            onSubmit={() => void addAll()}
          />
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] bg-fp-surface-2 px-4 py-5 text-center">
          <FlaskConical
            size={22}
            aria-hidden
            className="text-fp-text-3"
            strokeWidth={2}
          />
          <p className="text-[13.5px] font-bold">Thinking about something?</p>
          <p className="max-w-[340px] text-[12.5px] leading-[1.45] text-fp-text-2">
            A new car payment, a trip, a bigger grocery budget. Try it here and
            see what it does to each paycheck and to the rest of your plan.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const outcome = result?.items.find((o) => o.id === item.id)
            const problem = tryoutProblem(outcome)
            const name = nameOf(item)
            return (
              <li
                key={item.id}
                className="flex items-stretch gap-3 rounded-[14px] border border-fp-border px-3 py-[10px]"
              >
                <Spine
                  color={tryoutColor(item, (id) => catalog.get(id).color)}
                />
                <button
                  type="button"
                  onClick={() => open(item.kind, item.id)}
                  className="min-w-0 flex-1 text-start"
                >
                  <span className="block truncate text-[13.5px] font-bold">
                    {name}
                  </span>
                  <span className="fp-sensitive block text-[11.5px] leading-[1.4] text-fp-text-3">
                    {tryoutLine(item, outcome, calendar)}
                  </span>
                  {problem ? (
                    <StatusChip tone="danger" className="mt-1">
                      {problem}
                    </StatusChip>
                  ) : null}
                </button>
                <span className="flex flex-none items-center gap-2">
                  <Switch
                    checked={item.on}
                    onCheckedChange={() => toggle(item.id)}
                    aria-label={`Include ${name}`}
                  />
                  <ItemMenu
                    label={`More for ${name}`}
                    actions={[
                      { label: 'Edit', onSelect: () => open(item.kind, item.id) },
                      {
                        label: 'Add to my plan',
                        onSelect: () => void addOne(item),
                      },
                      {
                        label: 'Remove',
                        destructive: true,
                        onSelect: () => remove(item.id),
                      },
                    ]}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {TRY.map((t) => (
          <Button
            key={t.kind}
            type="button"
            variant="quiet"
            onClick={() => open(t.kind, null)}
            className="h-[34px] rounded-full px-3 text-[12.5px]"
          >
            <Plus size={14} aria-hidden />
            <t.icon size={14} aria-hidden />
            {t.label}
          </Button>
        ))}
      </div>

      {result ? (
        <WhatIfOutcome result={result} base={inputs.base} calendar={calendar} />
      ) : null}
    </ResponsiveDialog>
  )
}
