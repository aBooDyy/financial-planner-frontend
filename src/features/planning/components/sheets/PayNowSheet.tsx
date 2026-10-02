import { useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { remainderOf } from '#/features/planned/data/settle'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { payBill } from '#/features/planning/actions/payBill'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { dayMonth, money } from '#/features/planning/view/format'
import { heldInWallet, payEffect } from '#/features/planning/view/payNow'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { WalletPills } from '#/features/planning/components/editors/fields/WalletPills'

type Props = {
  billId: string
  occurrence?: string
  onClose: () => void
  /** Money a settled occurrence still holds: the leftover prompt. */
  onLeftover: (report: LeftoverReport, payingWalletId: string) => void
}

/** Pay now (02 anytime actions): any open occurrence, in full or in part, from any wallet. */
export function PayNowSheet(props: Props) {
  return usePlanningReady() ? <PayNowSheetBody {...props} /> : null
}

function PayNowSheetBody({ billId, occurrence, onClose, onLeftover }: Props) {
  const { inputs, state } = usePlannedData()
  const planning = usePlanning()
  const wallets = usePlanningWallets()
  const bill = inputs.bills.find((b) => b.id === billId)
  const status = planning.bills[billId] as
    | (typeof planning.bills)[string]
    | undefined
  const choices = status?.next.map((n) => n.occurrence) ?? []
  const [picked, setPicked] = useState(occurrence ?? choices.at(0) ?? '')
  const [mode, setMode] = useState<'full' | 'part'>('full')
  const [typed, setTyped] = useState('')
  const [walletId, setWalletId] = useState(
    bill?.walletId ?? wallets.list.at(0)?.id ?? '',
  )
  const [busy, setBusy] = useState(false)

  if (!bill) return null
  const currency = bill.currency
  const row = inputs.planned.find(
    (p) =>
      p.billId === billId && p.role === 'payment' && p.occurrence === picked,
  )
  const open = row ? remainderOf(row, state.index, inputs.rates) : bill.amount
  const amount =
    mode === 'full' ? open : (parseAmountToMinor(typed, currency) ?? 0)
  const walletName = wallets.byId.get(walletId)?.name ?? 'the wallet'
  const held = picked
    ? heldInWallet({
        billId,
        occurrence: picked,
        walletId,
        setAsides: inputs.setAsides,
        currency,
        rates: inputs.rates,
      })
    : 0
  const [line1, line2] = payEffect({ amount, held, walletName, currency })
  const block = !picked
    ? 'Nothing is left to pay on this bill'
    : amount <= 0
      ? 'Enter how much you paid'
      : !walletId
        ? 'Pick the wallet it was paid from'
        : null

  const submit = async () => {
    if (block) return
    setBusy(true)
    try {
      const result = await payBill(billId, {
        occurrence: picked,
        amount,
        walletId,
      })
      if (result.leftover.lines.length > 0)
        onLeftover(result.leftover, walletId)
      else {
        toast(`${bill.name} paid`)
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Pay ${bill.name}`}
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel={`Record ${money(amount, currency)} payment`}
          onSubmit={() => void submit()}
        />
      }
    >
      {choices.length > 1 ? (
        <div>
          <FieldLabel>Which one?</FieldLabel>
          <ChipRow label="Which one?">
            {choices.map((o) => (
              <Chip
                key={o}
                size="sm"
                active={o === picked}
                onClick={() => setPicked(o)}
              >
                Due {dayMonth(o)}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
      <PillSwitch
        label="How much?"
        options={[
          { value: 'full', label: 'Full amount' },
          { value: 'part', label: 'Different amount' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m)
          if (m === 'part' && !typed)
            setTyped(minorToInputValue(open, currency))
        }}
      />
      {mode === 'full' ? (
        <div className="rounded-[20px] bg-fp-surface-2 px-4 pt-4 pb-[14px] text-center">
          <div className="text-[13px] font-bold text-fp-text-2">Amount</div>
          <div className="mt-1 text-[34px] font-extrabold tracking-[-0.03em] text-fp-text tabular-nums">
            {money(open, currency)}
          </div>
        </div>
      ) : (
        <AmountWell
          question="How much did you pay?"
          currency={currency}
          amount={typed}
          onAmount={setTyped}
          tone="neutral"
          autoFocus
        />
      )}
      <div>
        <FieldLabel>Paid from</FieldLabel>
        <WalletPills
          label="Paid from"
          wallets={wallets.list}
          value={walletId}
          onChange={setWalletId}
        />
      </div>
      <InfoLine>
        <span className="block">{line1}</span>
        <span className="block font-medium text-fp-text-2">{line2}</span>
      </InfoLine>
    </ResponsiveDialog>
  )
}
