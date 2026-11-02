import { useMemo, useState } from 'react'
import { goalRowOf } from '#/features/goals/data/goalRow'
import { createGoal, updateGoal } from '#/features/goals/data/mutations'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type {
  GoalPreset,
  TrialTarget,
} from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { useWhatIf } from '#/features/planning/stores/whatIf'
import { nextColor } from '#/features/planning/view/colors'
import {
  goalBlock,
  goalFormOf,
  goalPreview,
  goalWriteOf,
  newGoalForm,
} from '#/features/planning/view/goalDraft'
import type { GoalForm } from '#/features/planning/view/goalDraft'
import { usePlanningWallets } from './usePlanningWallets'

/** The goal editor's state: the form, what blocks saving, the preview line and save. */
export function useGoalEditor(
  id: string | null,
  preset: GoalPreset | undefined,
  onDone: () => void,
  trial?: TrialTarget,
) {
  const { inputs, state, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const goal = id ? inputs.goals.find((g) => g.id === id) : undefined

  const tried = useWhatIf((s) =>
    s.items.find((i) => i.id === trial?.itemId && i.kind === 'goal'),
  )
  const [initial] = useState<GoalForm>(() =>
    goal
      ? goalFormOf(goal)
      : tried?.kind === 'goal'
        ? goalFormOf(
            goalRowOf(tried.draft, { id: tried.id, position: 0, ts: '' }),
          )
        : newGoalForm(
            {
              saveWalletId: wallets.list.at(0)?.id ?? null,
              color: nextColor(inputs.goals.map((g) => g.color)),
            },
            preset,
            wallets.base,
          ),
  )
  const [form, setForm] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const currency =
    goal?.currency ??
    (form.saveWalletId
      ? wallets.byId.get(form.saveWalletId)?.currency
      : undefined) ??
    wallets.base
  const saved = goal ? (state.progress[goal.id]?.progress ?? 0) : 0

  const block = goalBlock(form, currency, today)
  const preview = useMemo(
    () =>
      goalPreview(form, {
        calendar: state.funding.calendar,
        today,
        currency,
        saved,
      }),
    [form, state.funding.calendar, today, currency, saved],
  )

  const set = <TKey extends keyof GoalForm>(key: TKey, value: GoalForm[TKey]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setSubmitted(true)
    if (block) return
    const write = goalWriteOf(form, currency)
    if (trial) {
      useWhatIf.getState().save(trial.itemId, { kind: 'goal', draft: write })
    } else if (goal) {
      await updateGoal(goal.id, write)
      toast('Saved')
    } else {
      await createGoal(write)
      toast(`${write.name} added to your plan`)
    }
    onDone()
  }

  return {
    goal,
    form,
    set,
    currency,
    wallets: wallets.list,
    block,
    showErrors: submitted,
    preview,
    dirty: JSON.stringify(form) !== JSON.stringify(initial),
    save,
  }
}
