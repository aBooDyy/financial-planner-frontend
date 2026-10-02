import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
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
import type { PlanOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { addMoney } from '#/features/planning/actions/addMoney'
import type { MoneyPart } from '#/features/planning/actions/addMoney'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { usePlanOwner } from '#/features/planning/hooks/usePlanOwner'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import {
  leftToPlace,
  overCommitText,
  overCommits,
} from '#/features/planning/view/addMoney'
import { money } from '#/features/planning/view/format'
import { parseAmountToMinor } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { usePreferencesStore } from '#/stores/preferences'
import { Dot } from '#/features/planning/components/kit/Spine'
import { SplitRows } from './SplitRows'
import type { SplitRow } from './SplitRows'

const OUTSIDE = '__outside__'

type Props = {
  /** Null when started from a wallet ("Set aside…"): the sheet asks which bill or goal. */
  owner: PlanOwner | null
  /** The wallet it starts in. */
  walletId?: string
  onClose: () => void
}

/**
 * Add money (03 §3): set aside any amount, in one wallet or split, warning before
 * over-committing. Started from a wallet's "Set aside…" it begins in that wallet and asks for
 * the bill or goal instead.
 */
export function AddMoneySheet(props: Props) {
  return usePlanningReady() ? <AddMoneySheetBody {...props} /> : null
}

function AddMoneySheetBody({ owner, walletId: startIn, onClose }: Props) {
  const [picked, setPicked] = useState<PlanOwner | null>(owner)
  const info = usePlanOwner(picked)
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const { figures } = useMoneyFigures()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const defaultWallet =
    startIn ??
    (info?.kind === 'goal'
      ? info.goal.saveWalletId
      : (info?.bill.saveWalletId ?? info?.bill.walletId)) ??
    wallets.list.at(0)?.id ??
    OUTSIDE

  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState<string>(defaultWallet)
  const [outsideLabel, setOutsideLabel] = useState('')
  const [split, setSplit] = useState(false)
  const [rows, setRows] = useState<SplitRow[]>(() => [
    {
      key: 1,
      walletId: defaultWallet === OUTSIDE ? '' : defaultWallet,
      amount: '',
    },
    { key: 2, walletId: '', amount: '' },
  ])
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const currency =
    info?.currency ??
    (startIn ? wallets.byId.get(startIn)?.currency : undefined) ??
    wallets.base

  const total = parseAmountToMinor(amount, currency) ?? 0
  const parsedRows = rows.map((r) => ({
    ...r,
    minor: parseAmountToMinor(r.amount, currency) ?? 0,
  }))
  const parts: MoneyPart[] = split
    ? parsedRows
        .filter((r) => r.walletId && r.minor > 0)
        .map((r) => ({ walletId: r.walletId, amount: r.minor }))
    : walletId === OUTSIDE
      ? [{ externalLabel: outsideLabel.trim(), amount: total }]
      : [{ walletId, amount: total }]
  const left = split
    ? leftToPlace(
        total,
        parsedRows.map((r) => ({ amount: r.minor })),
      )
    : 0

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
  const over = overCommits(
    parts.flatMap((p) => ('walletId' in p ? [p] : [])),
    currency,
    freeByWallet,
    inputs.rates,
  )

  const block = !info
    ? 'Pick a bill or goal'
    : total <= 0
      ? 'Enter how much to set aside'
      : split && left !== 0
        ? 'The split has to add up'
        : !split && walletId === OUTSIDE && !outsideLabel.trim()
          ? 'Say where the money is held'
          : parts.length === 0
            ? 'Pick a wallet'
            : null

  const submit = async () => {
    if (block || !info) return
    setBusy(true)
    try {
      if (!picked) return
      await addMoney(picked, parts, { date })
      toast(`${money(total, currency)} set aside for ${info.name}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const walletName = (id: string) => wallets.byId.get(id)?.name ?? 'This wallet'
  const freeLine = (id: string) => {
    const w = figures.wallets[id] as
      | (typeof figures.wallets)[string]
      | undefined
    return w ? `${money(Math.max(0, w.free), w.currency)} free` : ''
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        owner
          ? `Add money to ${info?.name ?? ''}`
          : `Set aside in ${startIn ? walletName(startIn) : 'a wallet'}`
      }
      contentClassName="sm:max-w-[480px]"
      footer={
        <DialogActions
          hint={block}
          onCancel={onClose}
          ready={block === null}
          disabled={busy}
          submitLabel={
            over.length > 0 && block === null
              ? 'Set aside anyway'
              : `Set aside ${money(total, currency)}`
          }
          onSubmit={() => void submit()}
        />
      }
    >
      {owner ? null : (
        <OwnerPicker
          value={picked}
          onChange={setPicked}
          bills={inputs.bills}
          goals={inputs.goals}
        />
      )}

      <AmountWell
        question="How much?"
        currency={currency}
        amount={amount}
        onAmount={setAmount}
        tone="transfer"
        autoFocus
      >
        <span className="text-[12px] font-medium text-fp-text-3">
          It stays in the wallet. We just label it.
        </span>
      </AmountWell>

      {split ? (
        <SplitRows
          rows={rows}
          setRows={setRows}
          currency={currency}
          wallets={wallets.list}
          left={left}
        />
      ) : (
        <div>
          <FieldLabel>Set aside in</FieldLabel>
          <div
            role="radiogroup"
            aria-label="Set aside in"
            className="flex flex-col gap-2"
          >
            {wallets.list.map((w) => (
              <WalletCard
                key={w.id}
                active={walletId === w.id}
                onClick={() => setWalletId(w.id)}
                color={w.color}
                name={w.name}
                note={freeLine(w.id)}
              />
            ))}
            <WalletCard
              active={walletId === OUTSIDE}
              onClick={() => setWalletId(OUTSIDE)}
              color="var(--fp-text-3)"
              name="Held outside your wallets"
              note="Cash at home, money with family…"
            />
            {walletId === OUTSIDE ? (
              <Input
                aria-label="Where is it held?"
                value={outsideLabel}
                onChange={(e) => setOutsideLabel(e.target.value)}
                placeholder="e.g. Cash with mom"
                maxLength={80}
              />
            ) : null}
          </div>
        </div>
      )}

      <ToggleCard
        title="Split across wallets"
        description="Set aside parts of it in different wallets."
        checked={split}
        onCheckedChange={setSplit}
      />

      <div>
        <FieldLabel>When?</FieldLabel>
        <DateField
          value={date}
          onChange={(iso) => setDate(iso || today)}
          dateFormat={dateFormat}
          ariaLabel="When?"
          hint
        />
      </div>

      {over.map((o) => (
        <NoteBox key={o.walletId} tone="danger" icon={<TriangleAlert />}>
          {overCommitText(o, walletName(o.walletId))}
        </NoteBox>
      ))}
    </ResponsiveDialog>
  )
}

function WalletCard({
  active,
  onClick,
  color,
  name,
  note,
}: {
  active: boolean
  onClick: () => void
  color: string
  name: string
  note: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-[10px] rounded-[14px] border-[1.5px] px-[14px] py-[11px] text-start transition',
        active
          ? 'border-fp-accent bg-fp-accent-soft'
          : 'border-fp-border bg-fp-surface hover:border-fp-border-strong',
      )}
    >
      <Dot color={color} size={10} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-fp-text">
        {name}
      </span>
      <span className="flex-none text-[12.5px] text-fp-text-3 tabular-nums">
        {note}
      </span>
    </button>
  )
}

const ownerKey = (o: PlanOwner) => `${o.kind}:${o.id}`

/** "For" — the open bills and goals a wallet's money can be set aside for. */
function OwnerPicker({
  value,
  onChange,
  bills,
  goals,
}: {
  value: PlanOwner | null
  onChange: (owner: PlanOwner) => void
  bills: ReadonlyArray<{ id: string; name: string; closedAt: string | null }>
  goals: ReadonlyArray<{ id: string; name: string; closedAt: string | null }>
}) {
  const open = <T extends { closedAt: string | null }>(
    list: ReadonlyArray<T>,
  ) => list.filter((x) => x.closedAt === null)
  const groups = [
    { label: 'Bills', kind: 'bill' as const, items: open(bills) },
    { label: 'Goals', kind: 'goal' as const, items: open(goals) },
  ].filter((g) => g.items.length > 0)
  return (
    <div>
      <FieldLabel>For</FieldLabel>
      {groups.length === 0 ? (
        <p className="text-[13px] text-fp-text-3">
          Add a bill or goal on Planning first.
        </p>
      ) : (
        <Select
          value={value ? ownerKey(value) : undefined}
          onValueChange={(key) => {
            const [kind, id] = key.split(':') as ['bill' | 'goal', string]
            onChange({ kind, id })
          }}
        >
          <SelectTrigger aria-label="For" className="w-full">
            <SelectValue placeholder="Pick a bill or goal" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectGroup key={g.kind}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.items.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={ownerKey({ kind: g.kind, id: item.id })}
                  >
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
