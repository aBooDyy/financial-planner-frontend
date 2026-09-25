import { useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { LocalBalanceNode, LocalGoal, LocalMerchant } from '#/db/types'
import { SourceSection } from '#/features/inbound-imports/components/SourceSection'
import { ledgerSourceOf } from '#/features/inbound-imports/data/sources'
import { FREQUENCIES } from '#/features/goals/constants'
import { MerchantPicker } from '#/features/merchants/components/MerchantPicker'
import type { GoalFrequency } from '#/features/goals/api/types'
import type { BudgetScope } from '#/features/transactions/api/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useCountsToward } from '#/features/transactions/hooks/useCountsToward'
import { resolveTransfer } from '#/features/transactions/data/transferForm'
import type {
  EditorTxType,
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import {
  amountInputProps,
  formatMoney,
  parseAmountToMinor,
} from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { IconChip } from '#/components/icons/IconChip'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import { usePreferencesStore } from '#/stores/preferences'
import { CategoryPickerDialog } from './CategoryPickerDialog'
import { CountsTowardField } from './CountsTowardField'
import { TransferFields } from './TransferFields'

type Props = {
  editing: TxEditorState
  wallets: LocalBalanceNode[]
  /** Offered only when the entry already points at one. */
  archivedWalletIds?: ReadonlySet<string>
  goals: LocalGoal[]
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onType: (t: EditorTxType) => void
  onSwapTransfer: () => void
  base: CurrencyCode
  onCategory: (categoryId: string, subcategoryId: string | null) => void
  onGoal: (id: string | null) => void
  onMerchant: (merchant: LocalMerchant | null) => void
  onApplySuggestion: () => void
  onScopeType: (s: BudgetScope) => void
  /** `link` is the planned item the entry settles, as "Counts toward" resolved it. */
  onSave: (link?: { plannedId: string | null }) => void
  onDelete: () => void
  onClose: () => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const NONE = '__none__'

const typeBtn = (active: boolean) =>
  `flex-1 rounded-[8px] py-2 text-[13px] disabled:opacity-40 ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

const NO_IDS: ReadonlySet<string> = new Set()

const TYPE_LABELS: Record<EditorTxType, string> = {
  spend: 'Spend',
  income: 'Income',
  transfer: 'Transfer',
}

export function TxEditor({
  editing,
  wallets,
  archivedWalletIds = NO_IDS,
  goals,
  onField,
  onType,
  onSwapTransfer,
  base,
  onCategory,
  onGoal,
  onMerchant,
  onApplySuggestion,
  onScopeType,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { kind, id, draft, source, suggestion, missingSide } = editing
  const origin = ledgerSourceOf(source)
  const isTransfer = kind === 'tx' && draft.type === 'transfer'
  const noun = isTransfer
    ? 'transfer'
    : kind === 'tx'
      ? 'transaction'
      : kind === 'budget'
        ? 'budget'
        : 'recurring'
  const catalog = useCategoryCatalog()
  const category = catalog.get(draft.category)
  const subcategory = catalog.sub(draft.category, draft.subcategory)
  const [pickerOpen, setPickerOpen] = useState(false)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const counts = useCountsToward({
    type: draft.type,
    goalId: draft.goalId,
    plannedId: draft.plannedId,
    date: draft.date,
    goals,
  })
  const showCounts = kind === 'tx' && !isTransfer
  const selectCounts = (optionId: string | null) => {
    if (counts.isIncome) {
      counts.selectStream(optionId)
      if (draft.plannedId) onField('plannedId', null)
    } else onGoal(optionId)
  }

  const inUse = [draft.walletId, draft.toWalletId, draft.target]
  const choices = wallets.filter(
    (w) => !archivedWalletIds.has(w.id) || inUse.includes(w.id),
  )
  const walletLabel = (w: LocalBalanceNode) =>
    archivedWalletIds.has(w.id) ? `${w.name} (archived)` : w.name

  const currencyOf = (walletId: string): CurrencyCode =>
    wallets.find((w) => w.id === walletId)?.currency ?? base
  const fromCurrency = currencyOf(
    missingSide === 'from' ? draft.toWalletId : draft.walletId,
  )
  const transferMinor = parseAmountToMinor(draft.amount, fromCurrency)
  const saveBlocked =
    isTransfer && resolveTransfer(draft, currencyOf, missingSide) === null
  const saveLabel = isTransfer
    ? `Save transfer${
        transferMinor !== null && transferMinor > 0
          ? ` · ${formatMoney(transferMinor, fromCurrency)}`
          : ''
      }`
    : id
      ? 'Save'
      : 'Add'
  // A saved entry keeps its shape: a transfer is two legs, anything else is one row.
  const typeLocked = (t: EditorTxType): boolean =>
    id !== null && (t === 'transfer') !== isTransfer
  const types: EditorTxType[] =
    kind === 'tx' ? ['spend', 'income', 'transfer'] : ['spend', 'income']

  const footer = (
    <>
      {id ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="text-fp-danger hover:text-fp-danger"
        >
          Delete
        </Button>
      ) : null}
      <div className="flex-1" />
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button
        type="button"
        onClick={() =>
          onSave(showCounts ? { plannedId: counts.plannedId } : undefined)
        }
        disabled={saveBlocked}
        className={
          saveBlocked
            ? 'bg-fp-surface-2 text-fp-text-3 shadow-none disabled:cursor-default disabled:opacity-100'
            : undefined
        }
      >
        {saveLabel}
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={`${id ? 'Edit ' : 'New '}${noun}`}
      footer={footer}
      contentClassName="sm:max-w-[470px]"
    >
      <div className="flex flex-col gap-[15px]">
        {/* Type toggle (transactions & recurring) */}
        {kind !== 'budget' ? (
          <div className="inline-flex w-full rounded-[12px] border border-fp-border bg-fp-surface-2 p-[3px]">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onType(t)}
                disabled={typeLocked(t)}
                className={typeBtn(draft.type === t)}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        ) : null}

        {/* Budget scope */}
        {kind === 'budget' ? (
          <div>
            <Label className={LABEL}>Applies to</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['category', 'wallet', 'overall'] as BudgetScope[]).map((s) => {
                const active = draft.scopeType === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onScopeType(s)}
                    className="rounded-[11px] border px-1 py-[10px] text-[12.5px] font-semibold"
                    style={{
                      borderColor: active
                        ? 'var(--fp-accent)'
                        : 'var(--fp-border-strong)',
                      background: active
                        ? 'var(--fp-accent-soft)'
                        : 'var(--fp-surface-2)',
                      color: active
                        ? 'var(--fp-accent-ink)'
                        : 'var(--fp-text-2)',
                    }}
                  >
                    {s === 'category'
                      ? 'Category'
                      : s === 'wallet'
                        ? 'Account'
                        : 'Overall'}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Name (recurring) */}
        {kind === 'recurring' ? (
          <div>
            <Label className={LABEL}>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => onField('name', e.target.value)}
              placeholder="e.g. Rent, Netflix, Salary"
            />
          </div>
        ) : null}

        {isTransfer ? (
          <TransferFields
            draft={draft}
            wallets={choices}
            fromCurrency={fromCurrency}
            toCurrency={currencyOf(draft.toWalletId)}
            dateFormat={dateFormat}
            missingSide={missingSide}
            onField={onField}
            onSwap={onSwapTransfer}
          />
        ) : null}

        {/* Amount / limit (+ currency for budget) */}
        {isTransfer ? null : (
          <div className="flex gap-[10px]">
            <div className="flex-1">
              <Label className={LABEL}>
                {kind === 'budget' ? 'Limit' : 'Amount'}
              </Label>
              <Input
                value={kind === 'budget' ? draft.limit : draft.amount}
                onChange={(e) =>
                  onField(
                    kind === 'budget' ? 'limit' : 'amount',
                    e.target.value,
                  )
                }
                {...amountInputProps(draft.currency)}
                className="tabular-nums"
              />
            </div>
            {kind === 'budget' ? (
              <div className="w-[104px]">
                <Label className={LABEL}>Currency</Label>
                <CurrencyPicker
                  value={draft.currency}
                  onChange={(code) => onField('currency', code)}
                  align="end"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Budget target */}
        {kind === 'budget' && draft.scopeType !== 'overall' ? (
          <div>
            <Label className={LABEL}>
              {draft.scopeType === 'wallet' ? 'Account' : 'Category'}
            </Label>
            <Select
              value={draft.target}
              onValueChange={(v) => onField('target', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.scopeType === 'wallet'
                  ? choices.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {walletLabel(w)}
                      </SelectItem>
                    ))
                  : catalog.byType('spend').map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Category (transactions & recurring) — opens the two-step picker */}
        {kind !== 'budget' && !isTransfer ? (
          <div>
            <Label className={LABEL}>Category</Label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-[10px] rounded-[12px] border border-fp-border-strong bg-fp-surface-2 px-[10px] py-[8px] text-start hover:border-fp-accent"
            >
              <IconChip
                id={subcategory?.icon ?? category.icon}
                color={category.color}
                size={32}
                iconSize={18}
              />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fp-text">
                {catalog.labelOf(draft.category, draft.subcategory)}
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2}
                className="shrink-0 text-fp-text-3 rtl:-scale-x-100"
              />
            </button>
          </div>
        ) : null}

        {showCounts ? (
          <CountsTowardField counts={counts} onSelect={selectCounts} />
        ) : null}

        {/* Wallet (transactions & recurring) */}
        {kind !== 'budget' && !isTransfer ? (
          <div>
            <Label className={LABEL}>Account</Label>
            <Select
              value={draft.walletId || NONE}
              onValueChange={(v) => onField('walletId', v === NONE ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {choices.length === 0 ? (
                  <SelectItem value={NONE}>No wallets yet</SelectItem>
                ) : null}
                {choices.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {walletLabel(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Merchant (transactions only — who was paid) */}
        {kind === 'tx' && !isTransfer ? (
          <div>
            <Label className={LABEL}>
              Merchant{' '}
              <span className="font-medium text-fp-text-3">(optional)</span>
            </Label>
            <MerchantPicker
              value={draft.merchantId}
              valueName={draft.merchantName}
              onChange={onMerchant}
            />
            {suggestion ? (
              <button
                type="button"
                onClick={onApplySuggestion}
                className="mt-[7px] inline-flex items-center gap-1.5 rounded-full border border-fp-border bg-fp-surface-2 px-[11px] py-[5px] text-[12px] text-fp-text-2 hover:bg-fp-surface"
              >
                <Sparkles size={13} className="shrink-0 text-fp-accent-ink" />
                <span>
                  Usually{' '}
                  <span className="font-semibold text-fp-text">
                    {catalog.get(suggestion.category).name}
                  </span>{' '}
                  — use it
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Toward a goal (recurring spends; a transaction uses "Counts toward") */}
        {kind === 'recurring' && draft.type === 'spend' && goals.length > 0 ? (
          <div>
            <Label className={LABEL}>
              Toward a goal{' '}
              <span className="font-medium text-fp-text-3">(optional)</span>
            </Label>
            <Select
              value={draft.goalId ?? NONE}
              onValueChange={(v) => onGoal(v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not a contribution</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Frequency (recurring) */}
        {kind === 'recurring' ? (
          <div>
            <Label className={LABEL}>Repeats</Label>
            <Select
              value={draft.frequency}
              onValueChange={(v) => onField('frequency', v as GoalFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCIES) as GoalFrequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCIES[f].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Budget period */}
        {kind === 'budget' ? (
          <div>
            <Label className={LABEL}>Period</Label>
            <Select
              value={draft.period}
              onValueChange={(v) =>
                onField('period', v as TxEditorDraft['period'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {kind === 'budget' && draft.period === 'custom' ? (
          <div>
            <Label className={LABEL}>Period length (days)</Label>
            <Input
              value={draft.customDays}
              onChange={(e) => onField('customDays', e.target.value)}
              inputMode="numeric"
              placeholder="30"
              className="w-[120px] text-center tabular-nums"
            />
          </div>
        ) : null}

        {/* Date (transactions: Date; recurring: Next due date) */}
        {kind !== 'budget' && !isTransfer ? (
          <div>
            <Label className={LABEL}>
              {kind === 'recurring' ? 'Next due date' : 'Date'}
            </Label>
            <DateField
              value={draft.date}
              onChange={(iso) => onField('date', iso)}
              dateFormat={dateFormat}
              ariaLabel={kind === 'recurring' ? 'Next due date' : 'Date'}
            />
          </div>
        ) : null}

        {/* Note (transactions only) */}
        {kind === 'tx' && !isTransfer ? (
          <div>
            <Label className={LABEL}>
              Note{' '}
              <span className="font-medium text-fp-text-3">(optional)</span>
            </Label>
            <Input
              value={draft.note}
              onChange={(e) => onField('note', e.target.value)}
              placeholder="e.g. Tamimi Markets"
            />
          </div>
        ) : null}

        {/* Where an auto-logged transaction came from */}
        {kind === 'tx' && !isTransfer && id && origin ? (
          <SourceSection transactionId={id} origin={origin} />
        ) : null}

        {/* Autopost (recurring) */}
        {kind === 'recurring' ? (
          <label className="flex items-center gap-[11px] rounded-[12px] border border-fp-border-strong bg-fp-surface-2 px-[13px] py-3 text-start">
            <Switch
              checked={draft.autopost}
              onCheckedChange={(c) => onField('autopost', c)}
              className="flex-none"
            />
            <div>
              <div className="text-[13.5px] font-semibold text-fp-text">
                Auto-post on due date
              </div>
              <div className="text-[11.5px] text-fp-text-3">
                Log it automatically each cycle
              </div>
            </div>
          </label>
        ) : null}

        {/* Nested inside the editor's dialog: as a sibling, a pick would close the editor. */}
        {pickerOpen && draft.type !== 'transfer' ? (
          <CategoryPickerDialog
            type={draft.type}
            selected={draft.category}
            selectedSub={draft.subcategory}
            onSelect={(categoryId, subcategoryId) => {
              onCategory(categoryId, subcategoryId)
              setPickerOpen(false)
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
