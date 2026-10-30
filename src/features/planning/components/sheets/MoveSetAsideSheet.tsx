import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FieldLabel } from '#/components/FieldLabel'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import {
  moveHeldTo,
  moveSetAsideTo,
} from '#/features/planning/actions/moveSetAside'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import type { MoveFrom } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import {
  freeByWalletOf,
  freeNote,
  overCommitText,
  overCommits,
} from '#/features/planning/view/addMoney'
import {
  moveErrorText,
  moveSourceOf,
} from '#/features/planning/view/moveSetAside'
import type { MoveSource } from '#/features/planning/view/moveSetAside'
import {
  convertMinor,
  formatMoney,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { WalletCard } from './WalletCard'

type Props = { from: MoveFrom; onClose: () => void }

/**
 * Moves one set-aside, or what a bill or goal holds in one wallet, to another wallet. No real
 * money moves; the record of it stays in the history.
 */
export function MoveSetAsideSheet(props: Props) {
  const ready = usePlanningReady()
  const { loading } = useMoneyFigures()
  return ready && !loading ? <MoveSheetBody {...props} /> : null
}

function MoveSheetBody({ from, onClose }: Props) {
  const { inputs } = usePlannedData()
  const wallets = usePlanningWallets()
  const live = moveSourceOf(from, inputs)
  // Held while the write lands, so the form doesn't flicker as the rows it reads change.
  const [moving, setMoving] = useState<MoveSource | null>(null)
  const source = moving ?? live

  if (!source)
    return (
      <MoveNotice
        title="Nothing to move"
        text="This set-aside isn’t there any more."
        onClose={onClose}
      />
    )
  const targets = wallets.list.filter((w) => w.id !== source.walletId)
  const walletName = wallets.byId.get(source.walletId)?.name ?? 'This wallet'
  if (targets.length === 0)
    return (
      <MoveNotice
        title={`Move ${source.ownerName}`}
        text={`There’s no other wallet to move this to. Add another wallet first, or keep it in ${walletName}.`}
        onClose={onClose}
      />
    )
  return (
    <MoveForm
      from={from}
      source={source}
      walletName={walletName}
      targets={targets}
      onMoving={setMoving}
      onClose={onClose}
    />
  )
}

function MoveNotice({
  title,
  text,
  onClose,
}: {
  title: string
  text: string
  onClose: () => void
}) {
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      contentClassName="sm:max-w-[480px]"
      footer={<DialogActions submitLabel="Close" onSubmit={onClose} />}
    >
      <InfoLine>{text}</InfoLine>
    </ResponsiveDialog>
  )
}

function MoveForm({
  from,
  source,
  walletName,
  targets,
  onMoving,
  onClose,
}: {
  from: MoveFrom
  source: MoveSource
  walletName: string
  targets: ReadonlyArray<PlanningWallet>
  onMoving: (source: MoveSource | null) => void
  onClose: () => void
}) {
  const { inputs } = usePlannedData()
  const { figures } = useMoneyFigures()
  const freeInBase = (id: string) =>
    figures.activeWallets.find((w) => w.walletId === id)?.inBase.free ?? 0
  const roomiest = targets.reduce((best, w) =>
    freeInBase(w.id) > freeInBase(best.id) ? w : best,
  )
  const [amount, setAmount] = useState(
    minorToInputValue(source.amount, source.currency),
  )
  const [targetId, setTargetId] = useState(roomiest.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minor = parseAmountToMinor(amount, source.currency) ?? 0
  const target = targets.find((w) => w.id === targetId)
  const landed = target
    ? convertMinor(minor, source.currency, target.currency, inputs.rates)
    : 0
  const exact = (value: number) => formatMoney(value, source.currency)

  const block =
    minor <= 0
      ? 'Enter how much to move'
      : minor > source.amount
        ? `Only ${exact(source.amount)} is there`
        : !target
          ? 'Pick a wallet'
          : landed <= 0
            ? `That can’t be held in ${target.name}: it’s too small, or there’s no exchange rate`
            : null

  const over =
    target && block === null
      ? overCommits(
          [{ walletId: target.id, amount: minor }],
          source.currency,
          freeByWalletOf(figures.activeWallets),
          inputs.rates,
        )
      : []

  const submit = async () => {
    if (block || !target) return
    const part = minor === source.amount ? undefined : minor
    setBusy(true)
    setError(null)
    onMoving(source)
    try {
      if (from.kind === 'row') await moveSetAsideTo(from.id, target.id, part)
      else await moveHeldTo(from.owner, from.walletId, target.id, part)
      toast(`${exact(minor)} moved to ${target.name}`)
      onClose()
    } catch (e) {
      onMoving(null)
      setError(moveErrorText(e))
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
      title={`Move ${source.ownerName}`}
      description={`${exact(source.amount)} set aside in ${walletName}`}
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel={
            block !== null
              ? 'Move'
              : over.length > 0
                ? 'Move anyway'
                : `Move ${exact(minor)}`
          }
          onSubmit={() => void submit()}
        />
      }
    >
      <AmountWell
        question="How much?"
        currency={source.currency}
        amount={amount}
        onAmount={setAmount}
        tone="transfer"
        invalid={minor > source.amount}
      >
        <span className="text-[12px] font-medium text-fp-text-3">
          No real money moves. Only where it’s set aside changes.
        </span>
      </AmountWell>

      {from.kind === 'held' && source.dueDates > 1 ? (
        <p className="text-[12.5px] text-fp-text-2">
          This is everything set aside for {source.ownerName} in {walletName},
          across {source.dueDates} due dates.
        </p>
      ) : null}

      <div>
        <FieldLabel>Move to</FieldLabel>
        <div
          role="radiogroup"
          aria-label="Move to"
          className="flex flex-col gap-2"
        >
          {targets.map((w) => {
            const figure = figures.wallets[w.id] as
              | (typeof figures.wallets)[string]
              | undefined
            return (
              <WalletCard
                key={w.id}
                active={targetId === w.id}
                onClick={() => setTargetId(w.id)}
                color={w.color}
                name={w.name}
                note={figure ? freeNote(figure) : ''}
              />
            )
          })}
        </div>
      </div>

      {target && landed > 0 && target.currency !== source.currency ? (
        <InfoLine>
          {exact(minor)} becomes {formatMoney(landed, target.currency)} in{' '}
          {target.name}, at today’s rate.
        </InfoLine>
      ) : null}

      {over.map((o) => (
        <NoteBox key={o.walletId} tone="danger" icon={<TriangleAlert />}>
          {overCommitText(o, target?.name ?? 'This wallet')}
        </NoteBox>
      ))}

      {error ? (
        <NoteBox tone="danger" icon={<TriangleAlert />}>
          {error}
        </NoteBox>
      ) : null}
    </ResponsiveDialog>
  )
}
