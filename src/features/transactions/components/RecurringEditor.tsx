import { useMemo, useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import type { LocalGoal } from '#/db/types'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { CategoryOptions } from '#/features/categories/components/CategoryOptions'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { recurringDeleteCopy } from '#/features/transactions/data/scheduleEditor'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import {
  TYPE_TINT,
  cashflowBlock,
  entryAccountSections,
} from '#/features/transactions/data/txDialog'
import { useQuickChips } from '#/features/transactions/hooks/useQuickChips'
import type {
  EditorTxType,
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { EditorDialog } from './EditorDialog'
import { RecurringGoalSelect } from './RecurringGoalSelect'
import { RecurringScheduleFields } from './RecurringScheduleFields'
import { TxAccountPill } from './TxAccountPill'
import { TxCategoryChips } from './TxCategoryChips'
import { TxSection } from './TxSection'

type Props = {
  editing: TxEditorState
  /** Live accounts first, then archived ones — offered only when the schedule already uses one. */
  accounts: ReadonlyArray<TransferWallet>
  /** The live accounts as the Wallets tree groups them (`scopeSections`). */
  accountSections: ReadonlyArray<ScopeSection>
  archivedIds: ReadonlySet<string>
  goals: LocalGoal[]
  base: CurrencyCode
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onType: (t: EditorTxType) => void
  onCategory: (category: string, subcategory: string | null) => void
  onGoal: (id: string | null) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

const TYPES = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
] as const

const CHIP_COUNT = 4
const PANE_LIST = 'max-h-[min(440px,56vh)] min-h-[min(440px,56vh)]'

/** New / edit a recurring spend or income: what, how much, which category, and when it repeats. */
export function RecurringEditor({
  editing,
  accounts,
  accountSections,
  archivedIds,
  goals,
  base,
  onField,
  onType,
  onCategory,
  onGoal,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { id, draft } = editing
  const [picking, setPicking] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const catalog = useCategoryCatalog()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  const flowType = draft.type === 'income' ? 'income' : 'spend'
  const tint = TYPE_TINT[flowType].ink
  const chips = useQuickChips(flowType, CHIP_COUNT)
  // The list resets its highlight whenever this array changes identity.
  const categories = useMemo(
    () => catalog.byType(flowType),
    [catalog, flowType],
  )

  const wallet = accounts.find((w) => w.id === draft.walletId) ?? null
  const walletArchived = wallet !== null && archivedIds.has(wallet.id)
  const currency = wallet?.currency ?? base
  const amountMinor = parseAmountToMinor(draft.amount, currency)
  const hint = cashflowBlock(amountMinor, wallet !== null)
  const amountMissing = attempted && (amountMinor ?? 0) <= 0
  const walletMissing = attempted && wallet === null

  const back = () => setPicking(false)

  return (
    <EditorDialog
      title={id ? 'Edit recurring' : 'New recurring'}
      onClose={onClose}
      pane={
        picking
          ? {
              title: flowType === 'income' ? 'Income category' : 'Category',
              onBack: back,
            }
          : null
      }
      hint={hint}
      submitLabel={id ? 'Save' : 'Add'}
      onSubmit={() => (hint === null ? onSave() : setAttempted(true))}
      remove={
        id
          ? {
              ...recurringDeleteCopy(draft.name, flowType),
              onConfirm: onDelete,
            }
          : null
      }
    >
      {picking ? (
        <CategoryOptions
          categories={categories}
          category={draft.category}
          subcategory={draft.subcategory}
          onPick={(category, subcategory) => {
            onCategory(category, subcategory)
            back()
          }}
          listClassName={PANE_LIST}
        />
      ) : (
        <>
          <PillSwitch
            label="Type"
            options={TYPES}
            value={flowType}
            onChange={(t) => {
              setAttempted(false)
              onType(t)
            }}
            color={tint}
          />

          <div>
            <FieldLabel htmlFor="recurring-name" optional>
              What is it?
            </FieldLabel>
            <Input
              id="recurring-name"
              value={draft.name}
              onChange={(e) => onField('name', e.target.value)}
              placeholder="e.g. Rent, Netflix, Salary"
            />
          </div>

          <div>
            <AmountWell
              question="How much each time?"
              currency={currency}
              amount={draft.amount}
              onAmount={(v) => onField('amount', v)}
              invalid={amountMissing || walletMissing}
              tone={flowType === 'income' ? 'accent' : 'spend'}
            >
              <TxAccountPill
                label={flowType === 'income' ? 'Paid into' : 'Paid from'}
                sections={entryAccountSections(
                  accountSections,
                  walletArchived ? wallet : null,
                )}
                chosen={wallet}
                archived={walletArchived}
                onChange={(walletId) => onField('walletId', walletId)}
                invalid={walletMissing}
              />
            </AmountWell>
            <FieldMessage
              error={
                amountMissing
                  ? 'Enter an amount above 0.'
                  : walletMissing
                    ? accounts.every((w) => archivedIds.has(w.id))
                      ? 'No wallets yet — add one on the Wallets page first.'
                      : 'Pick a wallet first.'
                    : null
              }
            />
          </div>

          <TxSection label="Category">
            <TxCategoryChips
              chips={chips}
              category={draft.category}
              subcategory={draft.subcategory}
              onChange={onCategory}
              onAll={() => setPicking(true)}
            />
          </TxSection>

          {flowType === 'spend' && goals.length > 0 ? (
            <RecurringGoalSelect
              goals={goals}
              value={draft.goalId}
              onChange={onGoal}
            />
          ) : null}

          <RecurringScheduleFields
            frequency={draft.frequency}
            date={draft.date}
            autopost={draft.autopost}
            tint={tint}
            dateFormat={dateFormat}
            onFrequency={(f) => onField('frequency', f)}
            onDate={(iso) => onField('date', iso)}
            onAutopost={(on) => onField('autopost', on)}
          />
        </>
      )}
    </EditorDialog>
  )
}
