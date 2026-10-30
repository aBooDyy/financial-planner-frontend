import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { Checkbox } from '#/components/ui/checkbox'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { applyRebalance } from '#/features/planning/actions/moveSetAside'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import type { PlanningWallet } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import {
  freeByWalletOf,
  freeNote,
  overCommitText,
} from '#/features/planning/view/addMoney'
import { dueDay } from '#/features/planning/view/format'
import {
  moveErrorText,
  planOverCommits,
  reliefOf,
} from '#/features/planning/view/moveSetAside'
import { suggestRebalance } from '#/features/planning/view/rebalance'
import type { RebalanceMove } from '#/features/planning/view/rebalance'
import { convertMinor, formatMoney } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'

type Props = { walletId: string; onClose: () => void }

type Draft = { key: number; move: RebalanceMove; ticked: boolean }

/**
 * What to do about one over-committed wallet: a suggested set of moves to wallets with free money,
 * each of which can be dropped or sent elsewhere. Nothing is written until it is confirmed.
 */
export function FixOverSheet(props: Props) {
  const ready = usePlanningReady()
  const { loading } = useMoneyFigures()
  return ready && !loading ? <FixOverBody {...props} /> : null
}

function FixOverBody({ walletId, onClose }: Props) {
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const { figures } = useMoneyFigures()
  // Read once: a sync arriving while this is open must not rewrite what the user is editing.
  const [start] = useState(() => ({
    rows: inputs.setAsides,
    balance:
      figures.activeWallets.find((w) => w.walletId === walletId)?.balance ?? 0,
    plan: suggestRebalance({
      walletId,
      wallets: figures.activeWallets,
      setAsides: inputs.setAsides,
      bills: inputs.bills,
      goals: inputs.goals,
      rates: inputs.rates,
    }),
  }))
  const { plan, rows, balance } = start
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    plan.moves.map((move, key) => ({ key, move, ticked: true })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wallet = wallets.byId.get(walletId)
  const name = wallet?.name ?? 'This wallet'
  const currency = wallet?.currency ?? wallets.base
  const exact = (value: number) => formatMoney(value, currency)
  const targets = wallets.list.filter((w) => w.id !== walletId)

  const close = (open: boolean) => {
    if (!open) onClose()
  }
  const title = `Fix ${name}`

  if (plan.over === 0 || drafts.length === 0) {
    return (
      <ResponsiveDialog
        open
        onOpenChange={close}
        title={title}
        contentClassName="sm:max-w-[480px]"
        footer={<DialogActions submitLabel="Close" onSubmit={onClose} />}
      >
        <InfoLine>
          {plan.over === 0
            ? `${name} isn’t over any more. There’s nothing to fix.`
            : `${name} is ${exact(plan.over)} over, and there’s no free money in your other wallets to move it to.`}
        </InfoLine>
      </ResponsiveDialog>
    )
  }

  const ticked = drafts.filter((d) => d.ticked).map((d) => d.move)
  const free = freeByWalletOf(figures.activeWallets)
  const over = planOverCommits(ticked, free, inputs.rates)
  const relief = reliefOf(ticked, rows, currency, inputs.rates)
  const after = Math.max(0, plan.over - relief)
  const landsAsNothing = ticked.some((m) => {
    const target = free.get(m.toWalletId)
    return (
      !target ||
      convertMinor(m.amount, m.currency, target.currency, inputs.rates) <= 0
    )
  })
  const block =
    ticked.length === 0
      ? 'Tick at least one to move'
      : landsAsNothing
        ? 'One of these can’t be held in the wallet picked: there’s no exchange rate'
        : null

  const change = (key: number, next: Partial<Draft>) =>
    setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...next } : d)))

  const submit = async () => {
    if (block) return
    setBusy(true)
    setError(null)
    try {
      await applyRebalance(ticked)
      toast(`${exact(relief)} moved off ${name}`)
      onClose()
    } catch (e) {
      setError(moveErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={close}
      title={title}
      description={
        <>
          More is set aside in {name} than it has:{' '}
          <span className="fp-sensitive font-bold text-fp-danger tabular-nums">
            {exact(plan.over)} over
          </span>
          . No real money moves. Only where it’s set aside changes.
        </>
      }
      contentClassName="sm:max-w-[520px]"
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
                : `Move ${exact(relief)}`
          }
          onSubmit={() => void submit()}
        />
      }
    >
      {plan.shortBy > 0 ? (
        <NoteBox tone="warn" icon={<TriangleAlert />}>
          {plan.shortBy <= -balance
            ? `${name}’s balance is below zero, so it stays over by ${exact(plan.shortBy)} even with everything moved.`
            : `The other wallets don’t have enough room, so ${name} stays over by ${exact(plan.shortBy)}. You can still move what fits.`}
        </NoteBox>
      ) : null}

      <ul className="flex flex-col gap-2">
        {drafts.map((d) => (
          <FixMoveRow
            key={d.key}
            draft={d}
            due={dueOf(d.move, rows, inputs.goals)}
            today={today}
            targets={targets}
            freeNoteOf={(id) => {
              const room = free.get(id)
              return room ? freeNote(room) : ''
            }}
            landedIn={(id) => {
              const room = free.get(id)
              return room
                ? formatMoney(
                    convertMinor(
                      d.move.amount,
                      d.move.currency,
                      room.currency,
                      inputs.rates,
                    ),
                    room.currency,
                  )
                : ''
            }}
            onChange={(next) => change(d.key, next)}
          />
        ))}
      </ul>

      {after === 0 ? (
        <InfoLine>After this, {name} won’t be over any more.</InfoLine>
      ) : after !== plan.shortBy ? (
        <InfoLine>
          After this, {name} is still{' '}
          <span className="fp-sensitive tabular-nums">{exact(after)}</span>{' '}
          over.
        </InfoLine>
      ) : null}

      {over.map((o) => (
        <NoteBox key={o.walletId} tone="danger" icon={<TriangleAlert />}>
          {overCommitText(
            o,
            wallets.byId.get(o.walletId)?.name ?? 'This wallet',
          )}
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

/** A bill's due date for this money, or the goal's own date when it has one. */
function dueOf(
  move: RebalanceMove,
  rows: ReadonlyArray<{ id: string; goalId: string | null }>,
  goals: ReadonlyArray<{ id: string; dueDate: string | null }>,
): string | null {
  if (move.occurrence) return move.occurrence
  const goalId = rows.find((r) => r.id === move.setAsideId)?.goalId
  return goals.find((g) => g.id === goalId)?.dueDate ?? null
}

function FixMoveRow({
  draft,
  due,
  today,
  targets,
  freeNoteOf,
  landedIn,
  onChange,
}: {
  draft: Draft
  due: string | null
  today: string
  targets: ReadonlyArray<PlanningWallet>
  freeNoteOf: (walletId: string) => string
  landedIn: (walletId: string) => string
  onChange: (next: Partial<Draft>) => void
}) {
  const { move, ticked } = draft
  const target = targets.find((w) => w.id === move.toWalletId)
  return (
    <li
      className={cn(
        'flex flex-col gap-[10px] rounded-[14px] border-[1.5px] border-fp-border px-3 py-[11px]',
        !ticked && 'bg-fp-surface-2',
      )}
    >
      <div className="flex items-start gap-[10px]">
        <Checkbox
          aria-label={`Move ${move.ownerName}`}
          checked={ticked}
          onCheckedChange={(checked) => onChange({ ticked: checked === true })}
          className="mt-[2px]"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[14px] font-bold',
              ticked ? 'text-fp-text' : 'text-fp-text-3',
            )}
          >
            {move.ownerName}
          </span>
          {due ? (
            <span className="block text-[12px] text-fp-text-3">
              Due {dueDay(due, today)}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'fp-sensitive flex-none text-[14px] font-bold tabular-nums',
            ticked ? 'text-fp-text' : 'text-fp-text-3',
          )}
        >
          {formatMoney(move.amount, move.currency)}
        </span>
      </div>
      <Select
        value={move.toWalletId}
        disabled={!ticked}
        onValueChange={(toWalletId) =>
          onChange({ move: { ...move, toWalletId } })
        }
      >
        <SelectTrigger
          aria-label={`Where ${move.ownerName} moves to`}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {targets.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name} · {freeNoteOf(w.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {ticked && target && target.currency !== move.currency ? (
        <span className="fp-sensitive text-[12px] text-fp-text-2 tabular-nums">
          Becomes {landedIn(target.id)} in {target.name}, at today’s rate.
        </span>
      ) : null}
    </li>
  )
}
