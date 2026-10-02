import { useMemo, useState } from 'react'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { createIncome, updateIncome } from '#/features/goals/data/mutations'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { toast } from '#/features/planning/stores/toast'
import { nextColor } from '#/features/planning/view/colors'
import {
  incomeBlock,
  incomeFormOf,
  incomePreview,
  incomeWriteOf,
  newIncomeForm,
} from '#/features/planning/view/incomeDraft'
import type { IncomeForm } from '#/features/planning/view/incomeDraft'
import { updatePlanningSettings } from '#/features/wallets/data/mutations'
import { usePlanningWallets } from './usePlanningWallets'

/** The income editor's state: the form, whether it sets the pay periods, the preview and save. */
export function useIncomeEditor(id: string | null, onDone: () => void) {
  const { inputs, state, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const catalog = useCategoryCatalog()
  const stream = id ? inputs.income.find((s) => s.id === id) : undefined
  const calendar = state.funding.calendar
  const mainId = calendar.kind === 'paycheck' ? calendar.stream.id : null
  const isMain = stream !== undefined && stream.id === mainId

  const [initial] = useState<IncomeForm>(() =>
    stream
      ? incomeFormOf(stream)
      : newIncomeForm({
          walletId: wallets.list.at(0)?.id ?? null,
          categoryId:
            catalog.bySlug('salary')?.id ??
            catalog.fallbackFor('income')?.id ??
            null,
          color: nextColor(inputs.income.map((s) => s.color)),
        }),
  )
  const [form, setForm] = useState(initial)
  const [useForPeriods, setUseForPeriods] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const currency =
    (form.walletId ? wallets.byId.get(form.walletId)?.currency : undefined) ??
    stream?.currency ??
    wallets.base

  const block = incomeBlock(form, currency)
  const preview = useMemo(
    () => incomePreview(form, { today, currency }),
    [form, today, currency],
  )

  const set = <TKey extends keyof IncomeForm>(
    key: TKey,
    value: IncomeForm[TKey],
  ) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setSubmitted(true)
    if (block) return
    const write = incomeWriteOf(form, currency)
    let savedId = stream?.id
    if (stream) {
      await updateIncome(stream.id, write)
      toast('Saved')
    } else {
      savedId = await createIncome(write)
      toast(`${write.label} added to your plan`)
    }
    if (useForPeriods && savedId)
      await updatePlanningSettings({ mainIncomeStreamId: savedId })
    onDone()
  }

  return {
    stream,
    form,
    set,
    currency,
    wallets: wallets.list,
    isMain,
    /** A main paycheck exists already, so this one would only join it. */
    hasMain: mainId !== null,
    useForPeriods,
    setUseForPeriods,
    block,
    showErrors: submitted,
    preview,
    dirty: JSON.stringify(form) !== JSON.stringify(initial) || useForPeriods,
    save,
  }
}
