import { useMemo, useState } from 'react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import type { LocalGoal, LocalMerchant } from '#/db/types'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { CategoryOptions } from '#/features/categories/components/CategoryOptions'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { MerchantOptions } from '#/features/merchants/components/MerchantOptions'
import { useMerchantName } from '#/features/merchants/hooks/useMerchantName'
import {
  recurringDeleteCopy,
  recurringEndBlock,
} from '#/features/transactions/data/scheduleEditor'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import {
  NOTE_INPUT,
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
import { TxMerchantField } from './TxMerchantField'
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
  onCategory: (categoryId: string) => void
  onGoal: (id: string | null) => void
  onMerchant: (merchant: LocalMerchant | null) => void
  onApplySuggestion: () => void
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

type Pane = 'category' | 'merchant'

/** New / edit a recurring spend or income: what, how much, which category, where, and when it repeats. */
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
  onMerchant,
  onApplySuggestion,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { id, draft, suggestion } = editing
  const [pane, setPane] = useState<Pane | null>(null)
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
  const merchantName = useMerchantName(draft.merchantId, draft.merchantName)
  const endBlock = recurringEndBlock(draft.date, draft.endsOn)
  const hint = cashflowBlock(amountMinor, wallet !== null) ?? endBlock
  const amountMissing = attempted && (amountMinor ?? 0) <= 0
  const walletMissing = attempted && wallet === null

  const back = () => setPane(null)
  const paneTitle: Record<Pane, string> = {
    category: flowType === 'income' ? 'Income category' : 'Category',
    merchant: 'Merchant',
  }

  return (
    <EditorDialog
      title={id ? 'Edit recurring' : 'New recurring'}
      onClose={onClose}
      pane={pane ? { title: paneTitle[pane], onBack: back } : null}
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
      {pane === 'merchant' ? (
        <MerchantOptions
          value={draft.merchantId}
          onPick={(merchant) => {
            onMerchant(merchant)
            back()
          }}
          listClassName={PANE_LIST}
        />
      ) : pane === 'category' ? (
        <CategoryOptions
          categories={categories}
          value={draft.categoryId}
          onPick={(categoryId) => {
            onCategory(categoryId)
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
              categoryId={draft.categoryId}
              onChange={onCategory}
              onAll={() => setPane('category')}
            />
          </TxSection>

          <Input
            value={draft.note}
            onChange={(e) => onField('note', e.target.value)}
            aria-label="Note"
            placeholder="Add a note to each one"
            className={NOTE_INPUT}
          />

          <TxSection label="Where?">
            <TxMerchantField
              name={merchantName}
              onOpen={() => setPane('merchant')}
              suggestion={
                suggestion ? catalog.labelOf(suggestion.categoryId) : null
              }
              onApplySuggestion={onApplySuggestion}
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
            endsOn={draft.endsOn}
            endInvalid={endBlock !== null}
            autopost={draft.autopost}
            tint={tint}
            dateFormat={dateFormat}
            onFrequency={(f) => onField('frequency', f)}
            onDate={(iso) => onField('date', iso)}
            onEndsOn={(endsOn) => onField('endsOn', endsOn)}
            onAutopost={(on) => onField('autopost', on)}
          />
        </>
      )}
    </EditorDialog>
  )
}
