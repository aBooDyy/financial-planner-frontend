import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import {
  isEmailSourced,
  SourceEmailSection,
} from '#/features/email-sync/components/SourceEmailSection'
import { FREQUENCIES } from '#/features/goals/constants'
import type { GoalFrequency } from '#/features/goals/api/types'
import type { BudgetScope, TxType } from '#/features/transactions/api/types'
import {
  categoriesByType,
  subcategoriesOf,
} from '#/features/transactions/categories'
import type {
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { SUPPORTED_CURRENCIES } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
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
import { CategoryIcon } from './CategoryIcon'

type Props = {
  editing: TxEditorState
  wallets: LocalBalanceNode[]
  goals: LocalGoal[]
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onType: (t: TxType) => void
  onCategory: (id: string) => void
  onGoal: (id: string | null) => void
  onScopeType: (s: BudgetScope) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const NONE = '__none__'

const typeBtn = (active: boolean) =>
  `flex-1 rounded-[8px] py-2 text-[13px] ${
    active
      ? 'bg-fp-surface font-bold text-fp-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
      : 'bg-transparent font-semibold text-fp-text-2'
  }`

export function TxEditor({
  editing,
  wallets,
  goals,
  onField,
  onType,
  onCategory,
  onGoal,
  onScopeType,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { kind, id, draft, source } = editing
  const noun =
    kind === 'tx' ? 'transaction' : kind === 'budget' ? 'budget' : 'recurring'
  const subs = subcategoriesOf(draft.category)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

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
      <Button type="button" onClick={onSave}>
        {id ? 'Save' : 'Add'}
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
            <button
              type="button"
              onClick={() => onType('spend')}
              className={typeBtn(draft.type === 'spend')}
            >
              Spend
            </button>
            <button
              type="button"
              onClick={() => onType('income')}
              className={typeBtn(draft.type === 'income')}
            >
              Income
            </button>
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

        {/* Amount / limit (+ currency for budget) */}
        <div className="flex gap-[10px]">
          <div className="flex-1">
            <Label className={LABEL}>
              {kind === 'budget' ? 'Limit' : 'Amount'}
            </Label>
            <Input
              value={kind === 'budget' ? draft.limit : draft.amount}
              onChange={(e) =>
                onField(kind === 'budget' ? 'limit' : 'amount', e.target.value)
              }
              inputMode="decimal"
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          {kind === 'budget' ? (
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
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

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
                  ? wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))
                  : categoriesByType('spend').map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Category grid (transactions & recurring) */}
        {kind !== 'budget' ? (
          <div>
            <Label className={LABEL}>Category</Label>
            <div className="grid grid-cols-4 gap-[7px]">
              {categoriesByType(draft.type).map((c) => {
                const active = draft.category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => onCategory(c.id)}
                    className="flex flex-col items-center gap-1 rounded-[11px] border px-1 py-2"
                    style={{
                      borderColor: active ? c.color : 'var(--fp-border)',
                      background: active
                        ? `${c.color}1A`
                        : 'var(--fp-surface-2)',
                      color: active ? c.color : 'var(--fp-text-2)',
                    }}
                  >
                    <CategoryIcon categoryId={c.id} size={17} />
                    <span
                      className="truncate text-[9.5px] font-semibold"
                      style={{ color: active ? c.color : 'var(--fp-text-3)' }}
                    >
                      {c.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Subcategory */}
        {kind !== 'budget' && subs.length > 0 ? (
          <div>
            <Label className={LABEL}>
              Subcategory{' '}
              <span className="font-medium text-fp-text-3">(optional)</span>
            </Label>
            <Select
              value={draft.subcategory ?? NONE}
              onValueChange={(v) =>
                onField('subcategory', v === NONE ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {subs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Wallet (transactions & recurring) */}
        {kind !== 'budget' ? (
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
                {wallets.length === 0 ? (
                  <SelectItem value={NONE}>No wallets yet</SelectItem>
                ) : null}
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Toward a goal (transactions & recurring, spend only) */}
        {kind !== 'budget' && draft.type === 'spend' && goals.length > 0 ? (
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
        {kind !== 'budget' ? (
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
        {kind === 'tx' ? (
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

        {/* Source email (auto-logged transactions) */}
        {kind === 'tx' && id && isEmailSourced(source) ? (
          <SourceEmailSection transactionId={id} />
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
      </div>
    </ResponsiveDialog>
  )
}
