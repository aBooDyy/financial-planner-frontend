import { useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { setOccurrenceAmount } from '#/features/planning/actions/payBill'
import {
  occurrenceAmount,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { toast } from '#/features/planning/stores/toast'
import { cycleDate } from '#/features/planning/view/billCycles'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'

type Props = { billId: string; occurrence: string; onClose: () => void }

/** One due date's own amount ("this month's electricity came to SR 430"). */
export function CycleAmountSheet(props: Props) {
  return usePlanningReady() ? <CycleAmountSheetBody {...props} /> : null
}

function CycleAmountSheetBody({ billId, occurrence, onClose }: Props) {
  const { inputs, today } = usePlannedData()
  const bill = inputs.bills.find((b) => b.id === billId)
  const row = paymentRowsOf(billId, inputs.planned).get(occurrence)
  const [amount, setAmount] = useState(
    bill ? minorToInputValue(occurrenceAmount(bill, row), bill.currency) : '',
  )
  const [busy, setBusy] = useState(false)
  if (!bill) return null
  const minor = parseAmountToMinor(amount, bill.currency) ?? 0
  const block = minor <= 0 ? 'Enter how much this one is' : null

  const submit = async () => {
    if (block) return
    setBusy(true)
    try {
      await setOccurrenceAmount(billId, occurrence, minor)
      toast('Amount updated')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`${bill.name} · ${cycleDate(occurrence, today)}`}
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel="Save"
          onSubmit={() => void submit()}
        />
      }
    >
      <AmountWell
        question="How much is this one?"
        currency={bill.currency}
        amount={amount}
        onAmount={setAmount}
        tone="neutral"
        autoFocus
      />
      <InfoLine>
        Only this due date changes. The bill’s other dates, and your plan for
        them, keep their own amounts.
      </InfoLine>
    </ResponsiveDialog>
  )
}
