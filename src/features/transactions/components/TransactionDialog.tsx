import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LocalGoal, LocalMerchant } from '#/db/types'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { CategoryOptions } from '#/features/categories/components/CategoryOptions'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { SourceSection } from '#/features/inbound-imports/components/SourceSection'
import { ledgerSourceOf } from '#/features/inbound-imports/data/sources'
import { MerchantOptions } from '#/features/merchants/components/MerchantOptions'
import { useMerchantName } from '#/features/merchants/hooks/useMerchantName'
import type { ScopeSection } from '#/features/transactions/data/selectors'
import { resolveTransfer } from '#/features/transactions/data/transferForm'
import {
  AMOUNT_QUESTION,
  TYPE_TINT,
  cashflowBlock,
  dialogTitle,
  entryAccountSections,
  submitLabel,
  transferBlock,
} from '#/features/transactions/data/txDialog'
import { useCountsToward } from '#/features/transactions/hooks/useCountsToward'
import { useQuickChips } from '#/features/transactions/hooks/useQuickChips'
import type {
  EditorTxType,
  SaveLink,
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import type { RatesMap } from '#/lib/config/rates'
import { parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { CountsTowardOptions } from './CountsTowardOptions'
import { TxAccountPill } from './TxAccountPill'
import { TxAmountHero } from './TxAmountHero'
import { TxCashflowFields } from './TxCashflowFields'
import { DialogActions } from '#/components/dialog/DialogActions'
import { TxTransferFields } from './TxTransferFields'
import { TxTypeSwitch } from './TxTypeSwitch'

type Props = {
  editing: TxEditorState
  /** Live accounts first, then archived ones — offered only when the entry already uses one. */
  accounts: ReadonlyArray<TransferWallet>
  /** The live accounts as the Wallets tree groups them (`scopeSections`). */
  accountSections: ReadonlyArray<ScopeSection>
  archivedIds: ReadonlySet<string>
  goals: LocalGoal[]
  rates: RatesMap
  base: CurrencyCode
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onType: (t: EditorTxType) => void
  onSwapTransfer: () => void
  onResetReceived: () => void
  onCategory: (category: string, subcategory: string | null) => void
  onGoal: (id: string | null) => void
  onMerchant: (merchant: LocalMerchant | null) => void
  onApplySuggestion: () => void
  onSave: (link?: SaveLink) => void
  onDelete: () => void
  onClose: () => void
  onAddWallet: () => void
}

type Pane = 'form' | 'category' | 'merchant' | 'counts'

const CHIP_COUNT = 5
const PANE_LIST = 'max-h-[min(440px,56vh)] min-h-[min(440px,56vh)]'

/** New / edit a spend, income or transfer: one dialog, its pickers opening inside it. */
export function TransactionDialog({
  editing,
  accounts,
  accountSections,
  archivedIds,
  goals,
  rates,
  base,
  onField,
  onType,
  onSwapTransfer,
  onResetReceived,
  onCategory,
  onGoal,
  onMerchant,
  onApplySuggestion,
  onSave,
  onDelete,
  onClose,
  onAddWallet,
}: Props) {
  const { id, draft, source, suggestion, missingSide } = editing
  const [pane, setPane] = useState<Pane>('form')
  const [attempted, setAttempted] = useState(false)
  const catalog = useCategoryCatalog()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  const isTransfer = draft.type === 'transfer'
  const flowType = draft.type === 'income' ? 'income' : 'spend'
  const inUse = [draft.walletId, draft.toWalletId]
  const choices = accounts.filter(
    (w) => !archivedIds.has(w.id) || inUse.includes(w.id),
  )
  const currencyOf = (walletId: string): CurrencyCode =>
    accounts.find((w) => w.id === walletId)?.currency ?? base
  const currency = currencyOf(
    isTransfer && missingSide === 'from' ? draft.toWalletId : draft.walletId,
  )
  const amountMinor = parseAmountToMinor(draft.amount, currency)
  const wallet = choices.find((w) => w.id === draft.walletId) ?? null
  const hasWallet = wallet !== null
  const walletArchived = wallet !== null && archivedIds.has(wallet.id)

  const counts = useCountsToward({
    type: draft.type,
    isNew: id === null,
    goalId: draft.goalId,
    plannedId: draft.plannedId,
    amount: draft.amount,
    currency,
    date: draft.date,
    goals,
  })
  const chips = useQuickChips(flowType, CHIP_COUNT)
  // The list resets its highlight whenever this array changes identity.
  const categories = useMemo(
    () => catalog.byType(flowType),
    [catalog, flowType],
  )
  const merchantName = useMerchantName(draft.merchantId, draft.merchantName)

  const sameAccount =
    draft.walletId !== '' && draft.walletId === draft.toWalletId
  const transferReady =
    isTransfer && resolveTransfer(draft, currencyOf, missingSide) !== null
  const ready = isTransfer
    ? transferReady
    : cashflowBlock(amountMinor, hasWallet) === null
  const hint = isTransfer
    ? transferReady
      ? null
      : transferBlock(amountMinor, sameAccount)
    : cashflowBlock(amountMinor, hasWallet)
  const amountMissing = attempted && !isTransfer && (amountMinor ?? 0) <= 0
  const walletMissing = attempted && !isTransfer && !hasWallet

  const submit = () => {
    if (isTransfer) onSave()
    else if (ready) onSave(counts.link)
    else setAttempted(true)
  }
  const changeType = (type: EditorTxType) => {
    setAttempted(false)
    onType(type)
  }
  const back = () => setPane('form')
  const pickCounts = (optionId: string | null) => {
    counts.pick(optionId)
    if (!counts.isIncome) onGoal(optionId)
    else if (draft.plannedId) onField('plannedId', null)
    back()
  }

  const origin = ledgerSourceOf(source)
  const tint = TYPE_TINT[draft.type]
  const paneTitle: Record<Exclude<Pane, 'form'>, string> = {
    category: flowType === 'income' ? 'Income category' : 'Category',
    merchant: 'Merchant',
    counts: 'Counts toward',
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (open) return
        if (pane === 'form') onClose()
        else back()
      }}
      title={
        pane === 'form' ? dialogTitle(draft.type, id !== null) : paneTitle[pane]
      }
      onBack={pane === 'form' ? undefined : back}
      contentClassName="sm:max-w-[470px]"
      footer={
        pane === 'form' ? (
          <DialogActions
            hint={hint}
            onDelete={id !== null ? onDelete : undefined}
            onCancel={onClose}
            submitLabel={submitLabel({
              type: draft.type,
              editing: id !== null,
              amountMinor,
              currency,
            })}
            ready={ready}
            disabled={isTransfer && !ready}
            onSubmit={submit}
          />
        ) : undefined
      }
    >
      {pane === 'category' ? (
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
      ) : pane === 'merchant' ? (
        <MerchantOptions
          value={draft.merchantId}
          onPick={(merchant) => {
            onMerchant(merchant)
            back()
          }}
          listClassName={PANE_LIST}
        />
      ) : pane === 'counts' ? (
        <CountsTowardOptions
          options={counts.options}
          isIncome={counts.isIncome}
          selectedId={counts.selectedId}
          onPick={pickCounts}
          listClassName={PANE_LIST}
        />
      ) : (
        <div
          className="flex flex-col gap-3"
          style={
            { '--tx-ink': tint.ink, '--tx-soft': tint.soft } as CSSProperties
          }
        >
          <TxTypeSwitch
            value={draft.type}
            isLocked={(t) => id !== null && (t === 'transfer') !== isTransfer}
            onChange={changeType}
          />

          <TxAmountHero
            question={AMOUNT_QUESTION[draft.type]}
            currency={currency}
            amount={draft.amount}
            onAmount={(v) => onField('amount', v)}
            invalid={amountMissing || walletMissing}
          >
            {isTransfer ? null : (
              <TxAccountPill
                label={draft.type === 'income' ? 'Paid into' : 'Paid from'}
                sections={entryAccountSections(
                  accountSections,
                  walletArchived ? wallet : null,
                )}
                chosen={wallet}
                archived={walletArchived}
                onChange={(walletId) => onField('walletId', walletId)}
                invalid={walletMissing}
              />
            )}
          </TxAmountHero>
          {amountMissing ? (
            <p className="-mt-[6px] text-center text-[12.5px] font-semibold text-fp-danger">
              Enter an amount above 0.
            </p>
          ) : null}
          {walletMissing ? (
            <p className="-mt-[6px] text-center text-[12.5px] font-semibold text-fp-danger">
              {choices.length === 0 ? (
                <>
                  No wallets yet.{' '}
                  <button
                    type="button"
                    onClick={onAddWallet}
                    className="p-0 font-semibold text-fp-accent-ink underline"
                  >
                    Add a wallet
                  </button>{' '}
                  to log entries.
                </>
              ) : (
                'Pick a wallet first.'
              )}
            </p>
          ) : null}

          {isTransfer ? (
            <TxTransferFields
              draft={draft}
              accounts={choices}
              fromCurrency={currency}
              missingSide={missingSide}
              rates={rates}
              dateFormat={dateFormat}
              onField={onField}
              onSwap={onSwapTransfer}
              onResetReceived={onResetReceived}
            />
          ) : (
            <TxCashflowFields
              draft={draft}
              chips={chips}
              merchantName={merchantName}
              suggestion={
                suggestion
                  ? catalog.labelOf(suggestion.category, suggestion.subcategory)
                  : null
              }
              counts={counts}
              dateFormat={dateFormat}
              onField={onField}
              onCategory={onCategory}
              onApplySuggestion={onApplySuggestion}
              onOpen={setPane}
            />
          )}

          {!isTransfer && id && origin ? (
            <SourceSection transactionId={id} origin={origin} />
          ) : null}
        </div>
      )}
    </ResponsiveDialog>
  )
}
