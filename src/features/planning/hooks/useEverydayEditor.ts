import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { removeEveryday, saveEveryday } from '#/features/planning/actions/everyday'
import {
  averageMonthlySpend,
  averageWindow,
} from '#/features/planning/data/everyday'
import { toast } from '#/features/planning/stores/toast'
import {
  everydayBlock,
  everydayFormOf,
  everydayPreview,
  everydayWriteOf,
  suggestedAmount,
} from '#/features/planning/view/everydayDraft'
import type { EverydayForm } from '#/features/planning/view/everydayDraft'
import { minorToInputValue } from '#/lib/currency'

/** The everyday spending editor's state: the form, the recent average, the preview and save. */
export function useEverydayEditor(id: string | null, onDone: () => void) {
  const { inputs, state, today } = usePlannedData()
  const catalog = useCategoryCatalog()
  const { base, rates, budgets } = inputs
  const calendar = state.funding.calendar
  const budget = id ? budgets.find((b) => b.id === id) : undefined

  const [initial] = useState<EverydayForm>(() =>
    budget
      ? everydayFormOf(budget)
      : {
          categoryId: catalog.bySlug('groceries')?.id ?? '',
          amount: '',
          currency: base,
          period: 'monthly',
          customDays: '30',
        },
  )
  const [form, setForm] = useState(initial)
  const [submitted, setSubmitted] = useState(false)

  const set = <TKey extends keyof EverydayForm>(
    key: TKey,
    value: EverydayForm[TKey],
  ) => setForm((f) => ({ ...f, [key]: value }))

  /** A category that already has a budget starts from that budget's figures. */
  const pickCategory = (categoryId: string) => {
    const held = budgets.find(
      (b) =>
        b.id !== id &&
        b.scopeType === 'category' &&
        b.categoryId === categoryId,
    )
    setForm((f) =>
      held && !f.amount.trim()
        ? {
            ...f,
            categoryId,
            amount: minorToInputValue(held.limit, held.currency),
            currency: held.currency,
            period: held.period,
            customDays: String(held.customDays ?? 30),
          }
        : { ...f, categoryId },
    )
  }

  const window = averageWindow(today)
  const recent = useLiveQuery(
    () =>
      db.transactions
        .where('date')
        .between(window.from, window.to, true, false)
        .toArray(),
    [window.from, window.to],
  )
  const monthly = useMemo(
    () =>
      recent && form.categoryId
        ? averageMonthlySpend({
            txns: recent,
            rootOf: (c) => catalog.rootOf(c).id,
            rootId: form.categoryId,
            currency: form.currency,
            rates,
            today,
          })
        : null,
    [recent, form.categoryId, form.currency, catalog, rates, today],
  )

  const block = everydayBlock(form)
  const save = async () => {
    setSubmitted(true)
    if (block) return
    const write = everydayWriteOf(form)
    await saveEveryday(id, write)
    toast(
      budget
        ? 'Saved'
        : `${catalog.get(form.categoryId).name} added to your plan`,
    )
    onDone()
  }
  const removeFromPlan = budget
    ? async () => {
        await removeEveryday(budget.id)
        toast(`${catalog.get(budget.categoryId ?? '').name} taken out of your plan`)
        onDone()
      }
    : null

  return {
    budget,
    form,
    set,
    pickCategory,
    calendar,
    today,
    monthly,
    suggestion:
      monthly !== null ? suggestedAmount(monthly, form, calendar) : null,
    block,
    showErrors: submitted,
    preview: everydayPreview(form, { calendar, base, rates }),
    dirty: JSON.stringify(form) !== JSON.stringify(initial),
    save,
    removeFromPlan,
  }
}
