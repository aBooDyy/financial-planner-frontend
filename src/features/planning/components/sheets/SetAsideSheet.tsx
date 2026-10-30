import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalSetAside } from '#/db/types'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import {
  editSetAside,
  removeSetAside,
  setAsideAgain,
  takeBackSetAside,
} from '#/features/planning/actions/setAsideEdit'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { overCommitText, overCommits } from '#/features/planning/view/addMoney'
import { billCycles, cycleDate } from '#/features/planning/view/billCycles'
import { fullDate, money } from '#/features/planning/view/format'
import { setAsideStateOf } from '#/features/planning/view/setAsideState'
import {
  convertMinor,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { WalletPills } from '#/features/planning/components/editors/fields/WalletPills'

type Props = { id: string; onClose: () => void }

/**
 * One set-aside, from its bill's or goal's history: change it, take it back (the record stays) or
 * delete it (made by mistake). Money a payment used or a move carried off is only told about.
 */
export function SetAsideSheet(props: Props) {
  const ready = usePlanningReady()
  const { inputs } = usePlannedData()
  const row = inputs.setAsides.find((a) => a.id === props.id)
  if (!ready || !row) return null
  return <SetAsideSheetBody {...props} row={row} />
}

function SetAsideSheetBody({ row, onClose }: Props & { row: LocalSetAside }) {
  const { inputs } = usePlannedData()
  const ownerName = row.goalId
    ? inputs.goals.find((g) => g.id === row.goalId)?.name
    : inputs.bills.find((b) => b.id === row.billId)?.name
  const siblings = inputs.setAsides.filter((a) =>
    row.goalId ? a.goalId === row.goalId : a.billId === row.billId,
  )
  const state = setAsideStateOf(row, siblings)
  const title = `Set aside for ${ownerName ?? 'this'}`
  return state.kind === 'live' ? (
    <LiveSetAside row={row} title={title} onClose={onClose} />
  ) : (
    <ReleasedSetAside row={row} state={state} title={title} onClose={onClose} />
  )
}

function ReleasedSetAside({
  row,
  state,
  title,
  onClose,
}: {
  row: LocalSetAside
  state: Exclude<ReturnType<typeof setAsideStateOf>, { kind: 'live' }>
  title: string
  onClose: () => void
}) {
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const [confirming, setConfirming] = useState(false)
  const owner = row.goalId
    ? inputs.goals.find((g) => g.id === row.goalId)
    : inputs.bills.find((b) => b.id === row.billId)
  const place = row.walletId
    ? (wallets.byId.get(row.walletId)?.name ?? 'A deleted wallet')
    : (row.externalLabel ?? 'Held outside')
  const payment =
    state.kind === 'used'
      ? inputs.txns.find((t) => t.id === state.byId && t.type === 'spend')
      : undefined
  const canRestore =
    state.kind === 'freed' &&
    !!owner &&
    owner.closedAt === null &&
    (row.source === 'outside' || wallets.byId.has(row.walletId ?? ''))

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        title={title}
        contentClassName="sm:max-w-[480px]"
        footer={
          state.kind === 'freed' ? (
            <DialogActions
              onDelete={() => setConfirming(true)}
              onCancel={onClose}
              cancelLabel="Close"
              submitLabel="Set aside again"
              disabled={!canRestore}
              onSubmit={() =>
                void setAsideAgain(row.id).then(() => {
                  toast('Set aside again')
                  onClose()
                })
              }
            />
          ) : payment ? (
            <DialogActions
              onCancel={onClose}
              cancelLabel="Close"
              submitLabel="Open the payment"
              onSubmit={() =>
                openSheet({ kind: 'payment', transactionId: payment.id })
              }
            />
          ) : undefined
        }
      >
        <div className="rounded-[14px] bg-fp-surface-2 px-[14px] py-3">
          <div className="fp-sensitive text-[20px] font-extrabold tabular-nums">
            {money(row.amount, row.currency)}
          </div>
          <div className="mt-[2px] text-[12.5px] text-fp-text-2">
            {place} · set aside {cycleDate(row.date, today)}
          </div>
        </div>
        <InfoLine>
          {state.kind === 'used'
            ? payment
              ? `Used by the ${fullDate(payment.date)} payment. To change it, edit or delete that payment.`
              : 'Used by a transfer or payment. To change it, edit or delete that entry in Spending.'
            : state.kind === 'moved'
              ? 'Moved. The money is held somewhere else now, so this record can’t be changed.'
              : `Taken back on ${fullDate(state.on)}. The money is free to spend.`}
        </InfoLine>
      </ResponsiveDialog>
      <DeleteSetAside
        open={confirming}
        onOpenChange={setConfirming}
        id={row.id}
        live={false}
        onDone={onClose}
      />
    </>
  )
}

function DeleteSetAside({
  open,
  onOpenChange,
  id,
  live,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  id: string
  live: boolean
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this set-aside?"
      bullets={[
        ...(live ? ['The money is free to spend again.'] : []),
        live
          ? 'It disappears from the history, as if it never happened. To keep a record, use Take back.'
          : 'It disappears from the history.',
      ]}
      confirmLabel="Delete"
      busy={busy}
      onConfirm={() => {
        setBusy(true)
        void removeSetAside(id)
          .then(() => {
            toast('Set-aside deleted')
            onDone()
          })
          .finally(() => setBusy(false))
      }}
    />
  )
}

function LiveSetAside({
  row,
  title,
  onClose,
}: {
  row: LocalSetAside
  title: string
  onClose: () => void
}) {
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const { figures } = useMoneyFigures()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const [amount, setAmount] = useState(
    minorToInputValue(row.amount, row.currency),
  )
  const [currency, setCurrency] = useState(row.currency)
  const [source, setSource] = useState(row.source)
  const [walletId, setWalletId] = useState(
    row.walletId ?? wallets.list.at(0)?.id ?? '',
  )
  const [label, setLabel] = useState(row.externalLabel ?? '')
  const [date, setDate] = useState(row.date)
  const [occurrence, setOccurrence] = useState(row.occurrence)
  const [note, setNote] = useState(row.note ?? '')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const bill = row.billId
    ? inputs.bills.find((b) => b.id === row.billId)
    : undefined
  const occurrences = useMemo(() => {
    if (!bill) return []
    const cycles = billCycles({
      bill,
      planned: inputs.planned,
      txns: inputs.txns,
      setAsides: inputs.setAsides,
      rates: inputs.rates,
      today,
      upcoming: 12,
    })
    const open = [...cycles.due, ...cycles.upcoming]
      .filter((c) => c.state !== 'paid' && c.state !== 'skipped')
      .map((c) => c.occurrence)
    return row.occurrence && !open.includes(row.occurrence)
      ? [row.occurrence, ...open]
      : open
  }, [bill, inputs, today, row.occurrence])

  const minor = parseAmountToMinor(amount, currency) ?? 0
  const freeByWallet = useMemo(
    () =>
      new Map(
        Object.values(figures.wallets).map((w) => [
          w.walletId,
          { free: w.free, currency: w.currency },
        ]),
      ),
    [figures.wallets],
  )
  const alreadyThere =
    row.source === 'wallet' && row.walletId === walletId ? row.amount : 0
  const over =
    source === 'wallet'
      ? overCommits(
          [{ walletId, amount: minor - alreadyThere }],
          currency,
          freeByWallet,
          inputs.rates,
        )
      : []

  const pickWallet = (next: string) => {
    const to = wallets.byId.get(next)?.currency ?? currency
    if (to !== currency) {
      setAmount(
        minorToInputValue(convertMinor(minor, currency, to, inputs.rates), to),
      )
      setCurrency(to)
    }
    setWalletId(next)
  }

  const block =
    minor <= 0
      ? 'Enter how much is set aside'
      : source === 'wallet' && !walletId
        ? 'Pick a wallet'
        : source === 'outside' && !label.trim()
          ? 'Say where the money is held'
          : !date
            ? 'Pick when it was set aside'
            : null

  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true)
    try {
      await action()
      toast(message)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const owner = row.goalId
    ? inputs.goals.find((g) => g.id === row.goalId)
    : bill
  const canMove = row.source === 'wallet' && owner?.closedAt === null
  const takeBack = (
    <Button
      type="button"
      variant="quiet"
      size="dialog"
      disabled={busy}
      onClick={() => void run(() => takeBackSetAside(row.id), 'Taken back')}
    >
      Take back
    </Button>
  )

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        title={title}
        contentClassName="sm:max-w-[480px]"
        footer={
          <div className="flex w-full flex-col gap-2">
            {canMove ? (
              <div className="grid grid-cols-2 gap-2">
                {takeBack}
                <Button
                  type="button"
                  variant="quiet"
                  size="dialog"
                  disabled={busy}
                  onClick={() =>
                    openSheet({
                      kind: 'move',
                      from: { kind: 'row', id: row.id },
                    })
                  }
                >
                  Move
                </Button>
              </div>
            ) : null}
            <DialogActions
              hint={block}
              onDelete={() => setConfirming(true)}
              extra={canMove ? undefined : takeBack}
              ready={block === null}
              disabled={busy}
              submitLabel={
                over.length > 0 && block === null ? 'Save anyway' : 'Save'
              }
              onSubmit={() => {
                if (block) return
                void run(
                  () =>
                    editSetAside(row.id, {
                      source,
                      walletId: source === 'wallet' ? walletId : null,
                      externalLabel: source === 'outside' ? label.trim() : null,
                      amount: minor,
                      currency,
                      date,
                      note: note.trim() || null,
                      ...(bill ? { occurrence } : {}),
                    }),
                  'Saved',
                )
              }}
            />
          </div>
        }
      >
        <AmountWell
          question="How much?"
          currency={currency}
          amount={amount}
          onAmount={setAmount}
          tone="transfer"
        >
          <span className="text-[12px] font-medium text-fp-text-3">
            It stays in the wallet. We just label it.
          </span>
        </AmountWell>
        <div>
          <FieldLabel>Where is it?</FieldLabel>
          <PillSwitch
            label="Where is it?"
            options={[
              { value: 'wallet', label: 'In a wallet' },
              { value: 'outside', label: 'Held outside' },
            ]}
            value={source}
            onChange={setSource}
          />
        </div>
        {source === 'wallet' ? (
          <div className="flex flex-col gap-[6px]">
            <WalletPills
              label="Wallet"
              wallets={wallets.list}
              value={walletId}
              onChange={pickWallet}
            />
            <p className="text-[12px] leading-[1.45] text-fp-text-3">
              Changing the wallet here corrects a mistake and leaves no record.
              {canMove ? ' To keep a record, use Move.' : ''}
            </p>
          </div>
        ) : (
          <Input
            aria-label="Where is it held?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Cash with mom"
            maxLength={80}
          />
        )}
        <div>
          <FieldLabel>When was it set aside?</FieldLabel>
          <DateField
            value={date}
            onChange={(iso) => setDate(iso)}
            dateFormat={dateFormat}
            ariaLabel="When was it set aside?"
            hint
          />
        </div>
        {bill && occurrences.length > 1 ? (
          <div>
            <FieldLabel>Which due date is it for?</FieldLabel>
            <Select
              value={occurrence ?? undefined}
              onValueChange={setOccurrence}
            >
              <SelectTrigger
                aria-label="Which due date is it for?"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {occurrences.map((o) => (
                  <SelectItem key={o} value={o}>
                    {cycleDate(o, today)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <FormRow id="set-aside-note" label="Note" optional>
          <Input
            id="set-aside-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </FormRow>
        {over.map((o) => (
          <NoteBox key={o.walletId} tone="danger" icon={<TriangleAlert />}>
            {overCommitText(
              o,
              wallets.byId.get(o.walletId)?.name ?? 'This wallet',
            )}
          </NoteBox>
        ))}
      </ResponsiveDialog>
      <DeleteSetAside
        open={confirming}
        onOpenChange={setConfirming}
        id={row.id}
        live
        onDone={onClose}
      />
    </>
  )
}
