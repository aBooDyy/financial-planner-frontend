import { useMemo, useState } from 'react'
import { createBill, updateBill } from '#/features/bills/data/mutations'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { toast } from '#/features/planning/stores/toast'
import {
  billBlock,
  billFormOf,
  billPreview,
  billWriteOf,
  newBillForm,
} from '#/features/planning/view/billDraft'
import type { BillForm } from '#/features/planning/view/billDraft'
import { nextColor } from '#/features/planning/view/colors'
import { usePlanningWallets } from './usePlanningWallets'

/** The bill editor's state: the form, what blocks saving, the preview line and save. */
export function useBillEditor(id: string | null, onDone: () => void) {
  const { inputs, state, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const catalog = useCategoryCatalog()
  const bill = id ? inputs.bills.find((b) => b.id === id) : undefined

  const [initial] = useState<BillForm>(() =>
    bill
      ? billFormOf(bill)
      : newBillForm({
          walletId: wallets.list.at(0)?.id ?? null,
          categoryId:
            catalog.bySlug('housing')?.id ??
            catalog.fallbackFor('spend')?.id ??
            null,
          color: nextColor(inputs.bills.map((b) => b.color)),
        }),
  )
  const [form, setForm] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const currency =
    (form.walletId ? wallets.byId.get(form.walletId)?.currency : undefined) ??
    bill?.currency ??
    wallets.base

  const block = billBlock(form, currency)
  const preview = useMemo(
    () =>
      billPreview(form, {
        calendar: state.funding.calendar,
        today,
        currency,
      }),
    [form, state.funding.calendar, today, currency],
  )

  const set = <TKey extends keyof BillForm>(key: TKey, value: BillForm[TKey]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setSubmitted(true)
    if (block) return
    const write = billWriteOf(form, currency)
    if (bill) {
      await updateBill(bill.id, write)
      toast('Saved')
    } else {
      await createBill(write)
      toast(`${write.name} added to your plan`)
    }
    onDone()
  }

  return {
    bill,
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

export type BillEditorState = ReturnType<typeof useBillEditor>
