import { useMemo, useState } from 'react'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalMerchant,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import type { CategoryPrediction } from '#/features/merchants/hooks/useMerchantMatch'
import { predictionFor } from '#/features/merchants/hooks/useMerchantMatch'
import type { GoalFrequency, IntervalUnit } from '#/features/goals/api/types'
import {
  DEFAULT_CUSTOM_INTERVAL,
  DEFAULT_CUSTOM_UNIT,
} from '#/features/goals/constants'
import {
  repeatBlock,
  repeatDraftOf,
  repeatOfDraft,
} from '#/features/goals/data/cadence'
import type {
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'
import { isCashflow } from '#/features/transactions/api/types'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
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
import { useEntrySession } from '#/features/transactions/stores/entrySession'
import { useEntryDefaults } from './useEntryDefaults'

export type TxEditorKind = 'tx' | 'budget' | 'recurring'

/** A transfer is a third kind of entry here, though on disk it is two legs. */
export type EditorTxType = TxType | 'transfer'

export type TxEditorDraft = {
  type: EditorTxType
  amount: string
  /**
   * The leaf category: a subcategory's id when one was picked, else the root's. A budget
   * reads it as the root it caps.
   */
  categoryId: string
  /** The entry's wallet (a transfer's source); a budget reads it as the account it caps. */
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
  /** Repeat every `customInterval` `customUnit`s instead of `frequency`. */
  customRepeat: boolean
  customInterval: string
  customUnit: IntervalUnit
  autopost: boolean
  /** The last date an occurrence may fall on; null repeats forever. */
  endsOn: string | null
  // budget
  scopeType: BudgetScope
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
  catalog.byType(type).at(0)?.id ?? DELETED_CATEGORY_ID

/** A new schedule is most often a bill; start on Housing when the user kept it. */
const recurringCategoryOf = (catalog: CategoryCatalog): string => {
  const housing = catalog.bySlug('housing')
  return housing?.type === 'spend'
    ? housing.id
    : firstCategoryOf(catalog, 'spend')
}

/** Whether `id` is a live category filed as `type`. */
const isOfType = (catalog: CategoryCatalog, id: string, type: TxType) =>
  catalog.has(id) && catalog.rootOf(id).type === type

/** A learned category is only usable when it belongs to the type the row is being filed as. */
const appliesTo = (
  catalog: CategoryCatalog,
  prediction: CategoryPrediction | null,
  type: TxType,
): prediction is CategoryPrediction =>
  prediction !== null && isOfType(catalog, prediction.categoryId, type)

/** The spend root a category budget caps: the draft's own when it is one, else the first. */
const budgetRootOf = (catalog: CategoryCatalog, id: string): string => {
  const root = catalog.rootOf(id)
  return isOfType(catalog, root.id, 'spend')
    ? root.id
    : firstCategoryOf(catalog, 'spend')
}

export function useTxEditor(
  wallets: LocalBalanceNode[],
  base: CurrencyCode,
  rates: RatesMap,
  archivedIds: ReadonlySet<string>,
) {
  const catalog = useCategoryCatalog()
  const [editing, setEditing] = useState<TxEditorState | null>(null)
  const live = useMemo(
    () => wallets.filter((w) => !archivedIds.has(w.id)),
    [wallets, archivedIds],
  )
  const defaults = useEntryDefaults(live)
  const rememberEntry = useEntrySession((s) => s.rememberEntry)

  const defaultWalletId = defaults.walletId
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
    categoryId: firstCategoryOf(catalog, 'spend'),
    walletId: defaultWalletId,
    goalId: null,
    plannedId: null,
    merchantId: null,
    merchantName: '',
    date: defaults.date,
    note: '',
    toWalletId: defaults.toWalletId,
    toAmount: '',
    toAmountEdited: false,
    name: '',
    frequency: 'monthly',
    customRepeat: false,
    customInterval: String(DEFAULT_CUSTOM_INTERVAL),
    customUnit: DEFAULT_CUSTOM_UNIT,
    autopost: false,
    endsOn: null,
    scopeType: 'category',
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
        categoryId: t.categoryId ?? firstCategoryOf(catalog, t.type),
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
        categoryId: b.categoryId ?? firstCategoryOf(catalog, 'spend'),
        walletId: b.walletId ?? defaultWalletId,
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
        categoryId: recurringCategoryOf(catalog),
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
        categoryId: r.categoryId,
        walletId: r.walletId,
        goalId: r.goalId,
        merchantId: r.merchantId ?? null,
        ...repeatDraftOf(r, 'monthly'),
        autopost: r.autopost,
        date: r.nextDue,
        endsOn: r.endsOn ?? null,
        note: r.note ?? '',
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
      const categoryId = isOfType(catalog, prev.draft.categoryId, type)
        ? prev.draft.categoryId
        : firstCategoryOf(catalog, type)
      // A payday and a payment are different planned items; a new type drops the link.
      const plannedId = type === prev.draft.type ? prev.draft.plannedId : null
      return {
        ...prev,
        draft: { ...prev.draft, type, categoryId, plannedId },
      }
    })

  const setCategory = (categoryId: string) =>
    setEditing((prev) =>
      prev ? { ...prev, draft: { ...prev.draft, categoryId } } : prev,
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
          draft: { ...draft, categoryId: prediction.categoryId },
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
        draft: { ...prev.draft, categoryId: prev.suggestion.categoryId },
      }
    })

  const setScopeType = (scopeType: BudgetScope) =>
    setEditing((prev) => {
      if (!prev) return prev
      const { categoryId, walletId } = prev.draft
      return {
        ...prev,
        draft: {
          ...prev.draft,
          scopeType,
          categoryId: budgetRootOf(catalog, categoryId),
          walletId: walletId || defaultWalletId,
        },
      }
    })

  const remember = (
    walletId: string,
    toWalletId: string | undefined,
    date: string,
  ) => rememberEntry({ walletId, toWalletId, date, today: ymd(startOfToday()) })

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
      else {
        await createTransfer(payload)
        remember(draft.walletId, draft.toWalletId, draft.date)
      }
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
        categoryId: draft.categoryId,
        walletId: draft.walletId,
        goalId: draft.type === 'spend' ? (link?.goalId ?? draft.goalId) : null,
        plannedId: link ? link.plannedId : draft.plannedId,
        merchantId: draft.merchantId,
        date: draft.date,
        note: draft.note.trim() || null,
      }
      if (id) await updateTransaction(id, payload)
      else {
        await createTransaction(payload)
        remember(draft.walletId, undefined, draft.date)
      }
      close()
      return
    }

    if (kind === 'budget') {
      const limit = parseAmountToMinor(draft.limit, draft.currency) ?? 0
      if (limit <= 0) return
      const payload = {
        scopeType: draft.scopeType,
        categoryId:
          draft.scopeType === 'category'
            ? budgetRootOf(catalog, draft.categoryId)
            : null,
        walletId: draft.scopeType === 'wallet' ? draft.walletId : null,
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
    if (amount <= 0 || repeatBlock(draft)) return
    const payload = {
      name: draft.name.trim() || 'Recurring',
      type: draft.type,
      amount,
      currency,
      categoryId: draft.categoryId,
      walletId: draft.walletId,
      goalId: draft.type === 'spend' ? draft.goalId : null,
      merchantId: draft.merchantId,
      ...repeatOfDraft(draft),
      nextDue: draft.date,
      endsOn: draft.endsOn,
      autopost: draft.autopost,
      note: draft.note.trim() || null,
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
