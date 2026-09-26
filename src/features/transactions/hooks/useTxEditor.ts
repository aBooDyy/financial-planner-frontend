import { useState } from 'react'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalMerchant,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import type { CategoryPrediction } from '#/features/merchants/hooks/useMerchantMatch'
import { predictionFor } from '#/features/merchants/hooks/useMerchantMatch'
import type { GoalFrequency } from '#/features/goals/api/types'
import type {
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'
import { isCashflow } from '#/features/transactions/api/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from '#/features/transactions/data/transfers'
import {
  resolveTransfer,
  suggestReceived,
} from '#/features/transactions/data/transferForm'
import type { RatesMap } from '#/lib/config/rates'
import {
  addMonths,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import {
  createBudget,
  createRecurring,
  createTransaction,
  deleteBudget,
  deleteRecurring,
  deleteTransaction,
  updateBudget,
  updateRecurring,
  updateTransaction,
} from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

export type TxEditorKind = 'tx' | 'budget' | 'recurring'

/** A transfer is a third kind of entry here, though on disk it is two legs. */
export type EditorTxType = TxType | 'transfer'

export type TxEditorDraft = {
  type: EditorTxType
  amount: string
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  /** The planned item this entry settles (1e's match), or null for an unlinked entry. */
  plannedId: string | null
  merchantId: string | null
  /** Display only — the picker's live cache may not have caught up with a just-created row. */
  merchantName: string
  date: string
  note: string
  // transfer — `walletId` is the source
  toWalletId: string
  /** What the destination receives, in its currency. Tracks `amount` until edited. */
  toAmount: string
  toAmountEdited: boolean
  // recurring
  name: string
  frequency: GoalFrequency
  autopost: boolean
  // budget
  scopeType: BudgetScope
  target: string
  period: BudgetPeriod
  customDays: string
  limit: string
  currency: CurrencyCode
}

/** What "Counts toward" resolved: the planned item settled and, for a spend, the goal paid. */
export type SaveLink = { plannedId: string | null; goalId?: string | null }

export type TxEditorState = {
  kind: TxEditorKind
  id: string | null
  draft: TxEditorDraft
  /** Where an auto-logged entry came from — lets the editor offer its source email. */
  source?: string | null
  /** A learned category the merchant offers but `auto_categorize` did not apply for us. */
  suggestion?: CategoryPrediction | null
  /** A transfer whose leg on this side went with its deleted account; the other side stays editable. */
  missingSide?: 'from' | 'to'
}

const firstCategoryOf = (catalog: CategoryCatalog, type: TxType): string =>
  catalog.byType(type)[0]?.slug ?? 'other'

/** A new schedule is most often a bill; start on Housing when the user kept it. */
const recurringCategoryOf = (catalog: CategoryCatalog): string =>
  catalog.byType('spend').some((c) => c.slug === 'housing')
    ? 'housing'
    : firstCategoryOf(catalog, 'spend')

/** A learned category is only usable when it belongs to the type the row is being filed as. */
const appliesTo = (
  catalog: CategoryCatalog,
  prediction: CategoryPrediction | null,
  type: TxType,
): prediction is CategoryPrediction =>
  prediction !== null &&
  catalog.byType(type).some((c) => c.slug === prediction.category)

export function useTxEditor(
  wallets: LocalBalanceNode[],
  base: CurrencyCode,
  rates: RatesMap,
) {
  const catalog = useCategoryCatalog()
  const [editing, setEditing] = useState<TxEditorState | null>(null)

  const defaultWalletId = wallets[0]?.id ?? ''
  const walletCurrency = (walletId: string): CurrencyCode =>
    wallets.find((w) => w.id === walletId)?.currency ?? base
  const otherWallet = (walletId: string): string =>
    wallets.find((w) => w.id !== walletId)?.id ?? walletId

  /** Keeps an untouched "Received" in step with the amount and the two wallets. */
  const withReceived = (draft: TxEditorDraft): TxEditorDraft =>
    draft.type !== 'transfer' || draft.toAmountEdited
      ? draft
      : {
          ...draft,
          toAmount: suggestReceived(
            draft.amount,
            walletCurrency(draft.walletId),
            walletCurrency(draft.toWalletId),
            rates,
          ),
        }

  const blank = (): TxEditorDraft => ({
    type: 'spend',
    amount: '',
    category: firstCategoryOf(catalog, 'spend'),
    subcategory: null,
    walletId: defaultWalletId,
    goalId: null,
    plannedId: null,
    merchantId: null,
    merchantName: '',
    date: ymd(startOfToday()),
    note: '',
    toWalletId: otherWallet(defaultWalletId),
    toAmount: '',
    toAmountEdited: false,
    name: '',
    frequency: 'monthly',
    autopost: false,
    scopeType: 'category',
    target: firstCategoryOf(catalog, 'spend'),
    period: 'monthly',
    customDays: '30',
    limit: '',
    currency: base,
  })

  // --- Transactions ---
  const openAddTx = () => setEditing({ kind: 'tx', id: null, draft: blank() })
  const openEditTx = (t: LocalTransaction) => {
    if (!isCashflow(t.type)) return
    setEditing({
      kind: 'tx',
      id: t.id,
      source: t.source,
      draft: {
        ...blank(),
        type: t.type,
        amount: minorToInputValue(t.amount, t.currency),
        category: t.category ?? firstCategoryOf(catalog, t.type),
        subcategory: t.subcategory,
        walletId: t.walletId,
        goalId: t.goalId,
        plannedId: t.plannedId,
        merchantId: t.merchantId,
        merchantName: '',
        date: t.date,
        note: t.note ?? '',
      },
    })
  }

  // --- Transfers ---
  /** Opens on whichever legs are still held. A lone leg's amount is in its own currency. */
  const openEditTransfer = (
    transferId: string,
    legs: ReadonlyArray<LocalTransaction>,
  ) => {
    const out = legs.find((t) => t.type === 'transfer_out')
    const inn = legs.find((t) => t.type === 'transfer_in')
    const any = out ?? inn
    if (!any) return
    setEditing({
      kind: 'tx',
      id: transferId,
      missingSide: !out ? 'from' : !inn ? 'to' : undefined,
      draft: {
        ...blank(),
        type: 'transfer',
        amount: minorToInputValue(any.amount, any.currency),
        walletId: out?.walletId ?? '',
        toWalletId: inn?.walletId ?? '',
        toAmount: inn ? minorToInputValue(inn.amount, inn.currency) : '',
        toAmountEdited: true,
        date: any.date,
        note: any.note ?? '',
      },
    })
  }

  // --- Budgets ---
  const openAddBudget = () =>
    setEditing({ kind: 'budget', id: null, draft: blank() })
  const openEditBudget = (b: LocalBudget) =>
    setEditing({
      kind: 'budget',
      id: b.id,
      draft: {
        ...blank(),
        scopeType: b.scopeType,
        target:
          b.target ??
          (b.scopeType === 'wallet'
            ? defaultWalletId
            : firstCategoryOf(catalog, 'spend')),
        period: b.period,
        customDays: String(b.customDays ?? 30),
        limit: minorToInputValue(b.limit, b.currency),
        currency: b.currency,
      },
    })

  // --- Recurring ---
  const openAddRecurring = () =>
    setEditing({
      kind: 'recurring',
      id: null,
      draft: {
        ...blank(),
        category: recurringCategoryOf(catalog),
        date: ymd(addMonths(startOfToday(), 1)),
      },
    })
  const openEditRecurring = (r: LocalRecurring) =>
    setEditing({
      kind: 'recurring',
      id: r.id,
      draft: {
        ...blank(),
        name: r.name,
        type: r.type,
        amount: minorToInputValue(r.amount, r.currency),
        category: r.category,
        subcategory: r.subcategory,
        walletId: r.walletId,
        goalId: r.goalId,
        frequency: r.frequency,
        autopost: r.autopost,
        date: r.nextDue,
      },
    })

  const close = () => setEditing(null)

  const setField = <TKey extends keyof TxEditorDraft>(
    field: TKey,
    value: TxEditorDraft[TKey],
  ) =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            draft: withReceived({
              ...prev.draft,
              [field]: value,
              ...(field === 'toAmount' ? { toAmountEdited: true } : {}),
            }),
          }
        : prev,
    )

  const swapTransferWallets = () =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            draft: withReceived({
              ...prev.draft,
              walletId: prev.draft.toWalletId,
              toWalletId: prev.draft.walletId,
              toAmountEdited: false,
            }),
          }
        : prev,
    )

  const resetReceived = () =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            draft: withReceived({ ...prev.draft, toAmountEdited: false }),
          }
        : prev,
    )
  // Switching spend/income re-defaults the category to a valid one for that type.
  const setType = (type: EditorTxType) =>
    setEditing((prev) => {
      if (!prev) return prev
      if (type === 'transfer') {
        const { walletId, toWalletId } = prev.draft
        return {
          ...prev,
          suggestion: null,
          draft: withReceived({
            ...prev.draft,
            type,
            goalId: null,
            plannedId: null,
            toWalletId:
              toWalletId && toWalletId !== walletId
                ? toWalletId
                : otherWallet(walletId),
          }),
        }
      }
      const valid = catalog.byType(type).map((c) => c.slug)
      const category = valid.includes(prev.draft.category)
        ? prev.draft.category
        : valid[0]
      // A payday and a payment are different planned items; a new type drops the link.
      const plannedId = type === prev.draft.type ? prev.draft.plannedId : null
      return {
        ...prev,
        draft: { ...prev.draft, type, category, subcategory: null, plannedId },
      }
    })

  const setCategory = (category: string, subcategory: string | null = null) =>
    setEditing((prev) =>
      prev
        ? { ...prev, draft: { ...prev.draft, category, subcategory } }
        : prev,
    )

  // Paying toward a goal keeps the user's own category (rent paid is Housing, not
  // Savings). A different goal means a different planned item, so any match is dropped.
  const setGoal = (goalId: string | null) =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              goalId,
              plannedId:
                goalId === prev.draft.goalId ? prev.draft.plannedId : null,
            },
          }
        : prev,
    )

  /**
   * Tagging a row with a merchant is where `auto_categorize` is finally read: on, the learned
   * category is applied silently; off, it is offered as a suggestion the user can take.
   */
  const setMerchant = (merchant: LocalMerchant | null) =>
    setEditing((prev) => {
      if (!prev) return prev
      if (prev.draft.type === 'transfer') return prev
      const prediction = merchant ? predictionFor(merchant) : null
      const draft = {
        ...prev.draft,
        type: prev.draft.type,
        merchantId: merchant?.id ?? null,
        merchantName: merchant?.displayName ?? '',
      }
      if (prediction?.apply && appliesTo(catalog, prediction, draft.type)) {
        return {
          ...prev,
          suggestion: null,
          draft: {
            ...draft,
            category: prediction.category,
            subcategory: prediction.subcategory,
          },
        }
      }
      return {
        ...prev,
        suggestion: appliesTo(catalog, prediction, draft.type)
          ? prediction
          : null,
        draft,
      }
    })

  const applySuggestion = () =>
    setEditing((prev) => {
      if (!prev?.suggestion) return prev
      return {
        ...prev,
        suggestion: null,
        draft: {
          ...prev.draft,
          category: prev.suggestion.category,
          subcategory: prev.suggestion.subcategory,
        },
      }
    })

  const setScopeType = (scopeType: BudgetScope) =>
    setEditing((prev) => {
      if (!prev) return prev
      const target =
        scopeType === 'category'
          ? firstCategoryOf(catalog, 'spend')
          : scopeType === 'wallet'
            ? defaultWalletId
            : ''
      return { ...prev, draft: { ...prev.draft, scopeType, target } }
    })

  /** `link` overrides the draft's planned link and goal — the "Counts toward" field resolves them. */
  const save = async (link?: SaveLink) => {
    if (!editing) return
    const { kind, id, draft } = editing

    if (kind === 'tx' && draft.type === 'transfer') {
      const resolved = resolveTransfer(
        draft,
        walletCurrency,
        editing.missingSide,
      )
      if (!resolved) return
      const payload = {
        fromWalletId: draft.walletId,
        toWalletId: draft.toWalletId,
        ...resolved,
        date: draft.date,
        note: draft.note.trim() || null,
      }
      if (id) await updateTransfer(id, payload)
      else await createTransfer(payload)
      close()
      return
    }

    if (draft.type === 'transfer') return

    if (kind === 'tx') {
      if (!draft.walletId) return
      const currency = walletCurrency(draft.walletId)
      const amount = parseAmountToMinor(draft.amount, currency) ?? 0
      if (amount <= 0) return
      const payload = {
        type: draft.type,
        amount,
        currency,
        category: draft.category,
        subcategory: draft.subcategory,
        walletId: draft.walletId,
        goalId: draft.type === 'spend' ? (link?.goalId ?? draft.goalId) : null,
        plannedId: link ? link.plannedId : draft.plannedId,
        merchantId: draft.merchantId,
        date: draft.date,
        note: draft.note.trim() || null,
      }
      if (id) await updateTransaction(id, payload)
      else await createTransaction(payload)
      close()
      return
    }

    if (kind === 'budget') {
      const limit = parseAmountToMinor(draft.limit, draft.currency) ?? 0
      if (limit <= 0) return
      const payload = {
        scopeType: draft.scopeType,
        target: draft.scopeType === 'overall' ? null : draft.target,
        period: draft.period,
        customDays:
          draft.period === 'custom'
            ? Math.max(1, parseInt(draft.customDays, 10) || 30)
            : null,
        limit,
        currency: draft.currency,
      }
      if (id) await updateBudget(id, payload)
      else await createBudget(payload)
      close()
      return
    }

    if (!draft.walletId) return
    const currency = walletCurrency(draft.walletId)
    const amount = parseAmountToMinor(draft.amount, currency) ?? 0
    if (amount <= 0) return
    const payload = {
      name: draft.name.trim() || 'Recurring',
      type: draft.type,
      amount,
      currency,
      category: draft.category,
      subcategory: draft.subcategory,
      walletId: draft.walletId,
      goalId: draft.type === 'spend' ? draft.goalId : null,
      frequency: draft.frequency,
      nextDue: draft.date,
      autopost: draft.autopost,
    }
    if (id) await updateRecurring(id, payload)
    else await createRecurring(payload)
    close()
  }

  const remove = async () => {
    if (!editing?.id) return
    if (editing.kind === 'tx' && editing.draft.type === 'transfer')
      await deleteTransfer(editing.id)
    else if (editing.kind === 'tx') await deleteTransaction(editing.id)
    else if (editing.kind === 'budget') await deleteBudget(editing.id)
    else await deleteRecurring(editing.id)
    close()
  }

  return {
    editing,
    openAddTx,
    openEditTx,
    openEditTransfer,
    openAddBudget,
    openEditBudget,
    openAddRecurring,
    openEditRecurring,
    setField,
    setType,
    swapTransferWallets,
    resetReceived,
    setCategory,
    setGoal,
    setMerchant,
    applySuggestion,
    setScopeType,
    save,
    remove,
    close,
  }
}

export type TxEditorApi = ReturnType<typeof useTxEditor>
