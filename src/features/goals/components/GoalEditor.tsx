import { AlertTriangle, Plus, X } from 'lucide-react'
import type { LocalBalanceNode, LocalGoalAllocation } from '#/db/types'
import type { GoalFrequency, GoalKind } from '#/features/goals/api/types'
import { walletGroupOptions } from '#/features/balances/data/selectors'
import { reservedByWallet } from '#/features/goals/data/reservations'
import {
  FREQUENCY_OPTIONS,
  FREQUENCIES,
  GOAL_COLORS,
  KINDS,
  KIND_OPTIONS,
} from '#/features/goals/constants'
import {
  daysUntil,
  nextPayday,
  relUntil,
  startOfToday,
} from '#/features/goals/data/planning'
import type {
  AllocationRowDraft,
  EditorDraft,
  EditorState,
} from '#/features/goals/hooks/useGoalEditor'
import { parseAmountToMinor, SUPPORTED_CURRENCIES } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { formatDate } from '#/lib/date'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  editing: EditorState
  nodes: LocalBalanceNode[]
  // Live wallet balances + all reserves, so we can warn when a reserve over-draws a wallet.
  walletBalances: Record<string, number>
  allocations: LocalGoalAllocation[]
  rates: Partial<Record<string, number>>
  onField: <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) => void
  onKind: (kind: GoalKind) => void
  onAddAllocation: () => void
  onRemoveAllocation: (key: string) => void
  onAllocationSource: (key: string, value: string) => void
  onAllocationField: (
    key: string,
    field: 'amount' | 'externalLabel',
    value: string,
  ) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

export function GoalEditor({
  editing,
  nodes,
  walletBalances,
  allocations,
  rates,
  onField,
  onKind,
  onAddAllocation,
  onRemoveAllocation,
  onAllocationSource,
  onAllocationField,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { type, id, draft } = editing
  const isGoal = type === 'goal'
  const kind = draft.kind
  const isRecurring = kind === 'recurring' || kind === 'sinking'
  const today = startOfToday()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const walletGroups = walletGroupOptions(nodes)

  // Due/target date: a readout in the user's date format (the native picker can't honor it),
  // plus a flag when the date sits in the past.
  const hasDueDate = isGoal && kind !== 'openended'
  const isPastDue =
    hasDueDate && !!draft.dueISO && daysUntil(draft.dueISO, today) < 0
  const dueErrorLabel =
    kind === 'onetime'
      ? 'Target date is in the past'
      : 'Next due date is in the past'

  const title = id ? 'Edit ' : 'New '
  const titleNoun = !isGoal
    ? 'income'
    : kind === 'onetime'
      ? 'goal'
      : KINDS[kind].chip.toLowerCase()

  const amountLabel = !isGoal
    ? 'Amount'
    : kind === 'onetime'
      ? 'Target amount'
      : kind === 'openended'
        ? 'Monthly contribution'
        : 'Amount each time'

  // Wallets this goal's draft over-reserves: (reserves from other goals) + (this draft's rows)
  // exceeding the wallet's live balance. Over-reserving is allowed — we just warn first.
  const overReservedWallets = (() => {
    const empty = { names: [] as string[], ids: new Set<string>() }
    if (!isGoal) return empty
    const elsewhere = reservedByWallet(
      allocations.filter((a) => a.goalId !== id),
      nodes,
      rates,
    )
    const draftByWallet = new Map<string, number>()
    for (const row of draft.allocations) {
      if (row.source !== 'wallet' || !row.walletId) continue
      draftByWallet.set(
        row.walletId,
        (draftByWallet.get(row.walletId) ?? 0) +
          (parseAmountToMinor(row.amount, row.currency) ?? 0),
      )
    }
    const names: string[] = []
    const ids = new Set<string>()
    for (const [walletId, drafted] of draftByWallet) {
      const total = (elsewhere[walletId] ?? 0) + drafted
      if (total > (walletBalances[walletId] ?? 0) + 0.5) {
        ids.add(walletId)
        const node = nodes.find((n) => n.id === walletId)
        if (node) names.push(node.name)
      }
    }
    return { names, ids }
  })()
  const overReservedNames = overReservedWallets.names
  const overReservedIds = overReservedWallets.ids
  const hasOverReserve = overReservedNames.length > 0

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={
        <>
          {title}
          {titleNoun}
        </>
      }
      contentClassName="sm:max-w-[460px]"
      footer={
        <>
          {id ? (
            <Button
              variant="outline"
              onClick={onDelete}
              className="text-fp-danger hover:border-fp-danger hover:text-fp-danger"
            >
              Delete
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            variant={hasOverReserve ? 'destructive' : 'default'}
          >
            {hasOverReserve
              ? 'Save anyway'
              : id
                ? 'Save'
                : isGoal
                  ? 'Add'
                  : 'Add income'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        {isGoal && !id ? (
          <div>
            <Label className={LABEL}>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.map((key) => {
                const selected = kind === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onKind(key)}
                    className="flex flex-col items-start gap-[3px] rounded-[12px] border px-3 py-[11px] text-start"
                    style={{
                      borderColor: selected
                        ? 'var(--fp-accent)'
                        : 'var(--fp-border-strong)',
                      background: selected
                        ? 'var(--fp-accent-soft)'
                        : 'var(--fp-surface-2)',
                      color: selected
                        ? 'var(--fp-accent-ink)'
                        : 'var(--fp-text)',
                      boxShadow: selected
                        ? '0 0 0 3px var(--fp-accent-soft)'
                        : 'none',
                    }}
                  >
                    <span className="text-[13px] font-bold">
                      {KINDS[key].title}
                    </span>
                    <span className="text-[11px] leading-[1.3] opacity-75">
                      {KINDS[key].desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div>
          <Label className={LABEL}>{isGoal ? 'Name' : 'Source'}</Label>
          <Input
            value={draft.name}
            onChange={(e) => onField('name', e.target.value)}
            placeholder={
              isGoal
                ? 'e.g. New car, Rent, Emergency fund'
                : 'e.g. Salary, Freelance'
            }
          />
        </div>

        <div className="flex gap-[10px]">
          <div className="flex-1">
            <Label className={LABEL}>{amountLabel}</Label>
            <Input
              value={draft.amount}
              onChange={(e) => onField('amount', e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div className="w-[104px]">
            <Label className={LABEL}>Currency</Label>
            <Select
              value={draft.currency}
              onValueChange={(v) => onField('currency', v as CurrencyCode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(!isGoal || isRecurring) && (
          <div>
            <Label className={LABEL}>How often</Label>
            <Select
              value={draft.frequency}
              onValueChange={(v) => onField('frequency', v as GoalFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCIES[f].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isGoal ? (
          <div>
            <Label className={LABEL}>Paid on (day of month)</Label>
            <div className="flex items-center gap-3">
              <Input
                value={draft.day}
                onChange={(e) => onField('day', e.target.value)}
                inputMode="numeric"
                placeholder="27"
                className="w-[96px] text-center tabular-nums"
              />
              <span className="text-[12.5px] text-fp-text-3">
                Next:{' '}
                {formatDate(
                  nextPayday(parseInt(draft.day, 10) || 1, today),
                  dateFormat,
                )}
              </span>
            </div>
          </div>
        ) : null}

        {hasDueDate ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-[12px] font-semibold text-fp-text-2">
                {kind === 'onetime' ? 'Target date' : 'Next due date'}
              </label>
              <span
                className={`text-[12.5px] font-bold ${
                  isPastDue ? 'text-fp-danger' : 'text-fp-text-2'
                }`}
              >
                {draft.dueISO ? relUntil(draft.dueISO, today) : ''}
              </span>
            </div>
            <DateField
              value={draft.dueISO}
              onChange={(iso) => onField('dueISO', iso)}
              dateFormat={dateFormat}
              invalid={isPastDue}
              ariaLabel={kind === 'onetime' ? 'Target date' : 'Next due date'}
            />
            {isPastDue ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-fp-danger">
                <AlertTriangle
                  size={13}
                  strokeWidth={2.2}
                  className="shrink-0"
                />
                {dueErrorLabel}
              </div>
            ) : null}
          </div>
        ) : null}

        {isGoal ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] font-semibold text-fp-text-2">
                Set aside{' '}
                <span className="font-medium text-fp-text-3">(optional)</span>
              </label>
              <Button
                variant="outline"
                onClick={onAddAllocation}
                className="gap-1 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold text-fp-text-2 hover:text-fp-text"
              >
                <Plus size={14} strokeWidth={2.4} /> Add source
              </Button>
            </div>
            {draft.allocations.length === 0 ? (
              <div className="rounded-[11px] border border-dashed border-fp-border-strong px-3 py-3 text-[12px] leading-normal text-fp-text-3">
                Reserve from a wallet, or add an external source (a gift,
                someone’s help). Each shows in your wallet breakdown.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {draft.allocations.map((row) => (
                  <AllocationRow
                    key={row.key}
                    row={row}
                    over={!!row.walletId && overReservedIds.has(row.walletId)}
                    walletGroups={walletGroups}
                    onSource={onAllocationSource}
                    onField={onAllocationField}
                    onRemove={onRemoveAllocation}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div>
          <Label className={LABEL}>Color tag</Label>
          <div className="flex flex-wrap gap-[10px]">
            {GOAL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onField('color', color)}
                className="h-[27px] w-[27px] rounded-[8px] ring-1 ring-black/10"
                style={{
                  background: color,
                  outline:
                    draft.color === color
                      ? '2px solid var(--fp-text)'
                      : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {hasOverReserve ? (
          <div className="flex items-start gap-2 rounded-[11px] border border-fp-danger bg-fp-danger/10 px-3 py-[10px] text-[12.5px] leading-normal text-fp-danger">
            <AlertTriangle
              size={15}
              strokeWidth={2.2}
              className="mt-[1px] shrink-0"
            />
            <span>
              {overReservedNames.length === 1
                ? `That's more than ${overReservedNames[0]} holds`
                : `That's more than ${overReservedNames.join(' and ')} hold`}{' '}
              — its available balance will go negative. You can still save it.
            </span>
          </div>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}

type WalletGroup = ReturnType<typeof walletGroupOptions>[number]

const ALLOC_INPUT =
  'rounded-[9px] border border-fp-border-strong bg-fp-surface px-2.5 py-2 text-[13px] text-fp-text outline-none focus:border-fp-accent'

function AllocationRow({
  row,
  over,
  walletGroups,
  onSource,
  onField,
  onRemove,
}: {
  row: AllocationRowDraft
  over: boolean
  walletGroups: WalletGroup[]
  onSource: (key: string, value: string) => void
  onField: (
    key: string,
    field: 'amount' | 'externalLabel',
    value: string,
  ) => void
  onRemove: (key: string) => void
}) {
  const sourceValue =
    row.source === 'wallet' ? (row.walletId ?? 'external') : 'external'
  return (
    <div
      className={`rounded-[11px] border bg-fp-surface-2 p-2.5 ${
        over ? 'border-fp-danger' : 'border-fp-border-strong'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative w-[40%]">
          <Input
            value={row.amount}
            onChange={(e) => onField(row.key, 'amount', e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className={`${ALLOC_INPUT} h-auto bg-fp-surface pe-10 tabular-nums`}
          />
          <span className="pointer-events-none absolute inset-y-0 inset-e-2.5 flex items-center text-[11px] font-semibold text-fp-text-3">
            {row.currency}
          </span>
        </div>
        <Select value={sourceValue} onValueChange={(v) => onSource(row.key, v)}>
          <SelectTrigger className={`${ALLOC_INPUT} h-auto flex-1`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {walletGroups.map((g, gi) => (
              <SelectGroup key={gi}>
                <SelectLabel>{g.label ?? 'Wallets'}</SelectLabel>
                {g.wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            <SelectItem value="external">External source…</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onRemove(row.key)}
          aria-label="Remove source"
          className="h-8 w-8 rounded-[9px] bg-fp-surface text-fp-text-3 hover:text-fp-danger"
        >
          <X size={15} strokeWidth={2} />
        </Button>
      </div>
      {row.source === 'external' ? (
        <Input
          value={row.externalLabel}
          onChange={(e) => onField(row.key, 'externalLabel', e.target.value)}
          placeholder="Source name — e.g. Dad’s help, Grant"
          className={`${ALLOC_INPUT} mt-2 h-auto w-full bg-fp-surface`}
        />
      ) : null}
    </div>
  )
}
