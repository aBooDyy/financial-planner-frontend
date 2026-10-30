import { useMemo, useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { remainderOf } from '#/features/planned/data/settle'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { payBill } from '#/features/planning/actions/payBill'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { billCycles, payChoices } from '#/features/planning/view/billCycles'
import { money } from '#/features/planning/view/format'
import { heldInWallet, payEffect } from '#/features/planning/view/payNow'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { WalletPills } from '#/features/planning/components/editors/fields/WalletPills'

type Props = {
  billId: string
  occurrence?: string
  onClose: () => void
  /** Money a settled occurrence still holds: the leftover prompt. */
  onLeftover: (report: LeftoverReport, payingWalletId: string) => void
}

/** How many dates Pay now offers either side of today. */
const CHOICES_AHEAD = 6
const CHOICES_BACK = 36

/**
 * Pay now (02 anytime actions): any date not paid yet — overdue, coming up or further back — in
 * full or in part, from any wallet, on the day it really happened. A bill whose amount varies
 * asks what it came to, and whatever that is settles the date.
 */
export function PayNowSheet(props: Props) {
  return usePlanningReady() ? <PayNowSheetBody {...props} /> : null
}

function PayNowSheetBody({ billId, occurrence, onClose, onLeftover }: Props) {
  const { inputs, state, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const bill = inputs.bills.find((b) => b.id === billId)
  const groups = useMemo(
    () =>
      bill
        ? payChoices(
            billCycles({
              bill,
              planned: inputs.planned,
              txns: inputs.txns,
              setAsides: inputs.setAsides,
              rates: inputs.rates,
              today,
              upcoming: CHOICES_AHEAD,
              past: CHOICES_BACK,
              beforeStart: true,
            }),
            today,
          )
        : [],
    [bill, inputs, today],
  )
  const [picked, setPicked] = useState(
    occurrence ?? groups.at(0)?.choices.at(0)?.occurrence ?? '',
  )
  const [mode, setMode] = useState<'full' | 'part'>('full')
  const [typed, setTyped] = useState<string | null>(null)
  const [paidOn, setPaidOn] = useState(today)
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
  const open = row
    ? row.status === 'open'
      ? remainderOf(row, state.index, inputs.rates)
      : row.amount
    : bill.amount
  const asks = bill.amountVaries || mode === 'part'
  const shown = typed ?? minorToInputValue(open, currency)
  const amount = asks ? (parseAmountToMinor(shown, currency) ?? 0) : open
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
        date: paidOn,
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
      <div>
        <FieldLabel>Which due date?</FieldLabel>
        <Select
          value={picked || undefined}
          onValueChange={(next) => {
            setPicked(next)
            setTyped(null)
          }}
        >
          <SelectTrigger aria-label="Which due date?" className="w-full">
            <SelectValue placeholder="Nothing left to pay" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.choices.map((c) => (
                  <SelectItem key={c.occurrence} value={c.occurrence}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      {bill.amountVaries ? null : (
        <PillSwitch
          label="How much?"
          options={[
            { value: 'full', label: 'Full amount' },
            { value: 'part', label: 'Different amount' },
          ]}
          value={mode}
          onChange={setMode}
        />
      )}
      {asks ? (
        <AmountWell
          question={
            bill.amountVaries ? 'How much was it?' : 'How much did you pay?'
          }
          currency={currency}
          amount={shown}
          onAmount={setTyped}
          tone="neutral"
          autoFocus
        />
      ) : (
        <div className="rounded-[20px] bg-fp-surface-2 px-4 pt-4 pb-[14px] text-center">
          <div className="text-[13px] font-bold text-fp-text-2">Amount</div>
          <div className="mt-1 text-[34px] font-extrabold tracking-[-0.03em] text-fp-text tabular-nums">
            {money(open, currency)}
          </div>
        </div>
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
      <div>
        <FieldLabel>When did you pay it?</FieldLabel>
        <DateField
          value={paidOn}
          onChange={(iso) => setPaidOn(iso || today)}
          dateFormat={dateFormat}
          ariaLabel="When did you pay it?"
          hint
        />
      </div>
      <InfoLine>
        <span className="block">{line1}</span>
        <span className="block font-medium text-fp-text-2">{line2}</span>
      </InfoLine>
    </ResponsiveDialog>
  )
}
