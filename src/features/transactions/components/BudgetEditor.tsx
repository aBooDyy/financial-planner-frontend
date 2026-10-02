import { useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { AmountWell } from '#/components/dialog/AmountWell'
import { OptionTiles } from '#/components/dialog/OptionTiles'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import type { LocalBalanceNode } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { BudgetScope } from '#/features/transactions/api/types'
import {
  BUDGET_SCOPES,
  billLines,
  billsInBudget,
  budgetBlock,
  budgetDeleteCopy,
  customDaysValid,
  paycheckHint,
} from '#/features/transactions/data/scheduleEditor'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { useBudgetPlanContext } from '#/features/transactions/hooks/useBudgetPlanContext'
import type {
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { parseAmountToMinor } from '#/lib/currency'
import { BudgetPeriodFields } from './BudgetPeriodFields'
import { BudgetTargetSelect } from './BudgetTargetSelect'
import { EditorDialog } from './EditorDialog'
import { TxSection } from './TxSection'

type Props = {
  editing: TxEditorState
  wallets: LocalBalanceNode[]
  /** Offered only when the budget already points at one. */
  archivedWalletIds: ReadonlySet<string>
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onScopeType: (s: BudgetScope) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

const TINT = 'var(--fp-spend)'

/** New / edit a budget: what it covers, how much, and how often it resets. */
export function BudgetEditor({
  editing,
  wallets,
  archivedWalletIds,
  onField,
  onScopeType,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { id, draft } = editing
  const [attempted, setAttempted] = useState(false)
  const catalog = useCategoryCatalog()
  const today = ymd(startOfToday())
  const plan = useBudgetPlanContext(today)

  const target =
    draft.scopeType === 'wallet' ? draft.walletId : draft.categoryId
  const choices = wallets.filter(
    (w) => !archivedWalletIds.has(w.id) || w.id === draft.walletId,
  )
  const walletLabel = (w: LocalBalanceNode) =>
    archivedWalletIds.has(w.id) ? `${w.name} (archived)` : w.name

  const limitMinor = parseAmountToMinor(draft.limit, draft.currency)
  const hint = budgetBlock({ ...draft, targetId: target, limitMinor })
  const limitMissing = attempted && (limitMinor ?? 0) <= 0
  const daysInvalid =
    attempted && draft.period === 'custom' && !customDaysValid(draft.customDays)
  const targetMissing = attempted && draft.scopeType !== 'overall' && !target

  const covered = billsInBudget(plan.bills, draft, catalog)
  const bills = billLines(covered, draft, catalog, wallets)

  const label =
    draft.scopeType === 'overall'
      ? 'Overall'
      : draft.scopeType === 'wallet'
        ? (wallets.find((w) => w.id === draft.walletId)?.name ?? 'Account')
        : catalog.get(draft.categoryId).name

  return (
    <EditorDialog
      title={id ? 'Edit budget' : 'New budget'}
      onClose={onClose}
      hint={hint}
      submitLabel={id ? 'Save' : 'Add'}
      onSubmit={() => (hint === null ? onSave() : setAttempted(true))}
      remove={id ? { ...budgetDeleteCopy(label), onConfirm: onDelete } : null}
    >
      <TxSection label="What does it cover?">
        <OptionTiles
          label="Budget covers"
          options={BUDGET_SCOPES}
          value={draft.scopeType}
          onChange={onScopeType}
          columns={3}
          color={TINT}
        />
      </TxSection>

      <div>
        <AmountWell
          question="How much can you spend?"
          currency={draft.currency}
          amount={draft.limit}
          onAmount={(v) => onField('limit', v)}
          invalid={limitMissing}
          tone="spend"
        >
          <CurrencyPicker
            value={draft.currency}
            onChange={(code) => onField('currency', code)}
            appearance="pill"
            prefix="Currency"
            align="center"
          />
        </AmountWell>
        <FieldMessage
          error={limitMissing ? 'Enter an amount above 0.' : null}
        />
      </div>

      {draft.scopeType !== 'overall' ? (
        <div>
          <FieldLabel htmlFor="budget-target">
            {draft.scopeType === 'wallet'
              ? 'Which account?'
              : 'Which category?'}
          </FieldLabel>
          <BudgetTargetSelect
            id="budget-target"
            scope={draft.scopeType}
            value={target}
            onChange={(v) =>
              draft.scopeType === 'wallet'
                ? onField('walletId', v)
                : onField('categoryId', v)
            }
            wallets={choices}
            walletLabel={walletLabel}
          />
          <FieldMessage
            error={
              targetMissing
                ? draft.scopeType === 'wallet'
                  ? 'Add a wallet on the Wallets page first.'
                  : 'Pick a category.'
                : null
            }
          />
        </div>
      ) : null}

      <BudgetPeriodFields
        period={draft.period}
        customDays={draft.customDays}
        daysInvalid={daysInvalid}
        paycheckHint={
          plan.payCalendar ? paycheckHint(plan.payCalendar, today) : null
        }
        onPeriod={(p) => onField('period', p)}
        onCustomDays={(d) => onField('customDays', d)}
      />

      <div className="flex flex-col gap-2">
        <ToggleCard
          title="Leave out planned bills"
          description="Only count spending you didn’t plan for."
          checked={draft.excludesBills}
          onCheckedChange={(on) => onField('excludesBills', on)}
        />
        {bills.length > 0 ? (
          <ul className="flex flex-col gap-[3px] px-[14px] text-[12px] leading-[1.45] font-semibold text-fp-text-3">
            {bills.map((line) => (
              <li key={line} className="fp-sensitive">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </EditorDialog>
  )
}
