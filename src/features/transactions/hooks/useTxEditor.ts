import { useState } from 'react'
import type {
  LocalBalanceNode,
  LocalBudget,
  LocalRecurring,
  LocalTransaction,
} from '#/db/types'
import type { GoalFrequency } from '#/features/goals/api/types'
import type {
  BudgetPeriod,
  BudgetScope,
  TxType,
} from '#/features/transactions/api/types'
import {
  categoriesByType,
  SAVINGS_CATEGORY_ID,
} from '#/features/transactions/categories'
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

export type TxEditorDraft = {
  type: TxType
  amount: string
  category: string
  subcategory: string | null
  walletId: string
  goalId: string | null
  date: string
  note: string
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

export type TxEditorState = {
  kind: TxEditorKind
  id: string | null
  draft: TxEditorDraft
  /** Where an auto-logged entry came from — lets the editor offer its source email. */
  source?: string | null
}

const firstCategoryOf = (type: TxType): string =>
  categoriesByType(type)[0]?.id ?? 'other'

export function useTxEditor(wallets: LocalBalanceNode[], base: CurrencyCode) {
  const [editing, setEditing] = useState<TxEditorState | null>(null)

  const defaultWalletId = wallets[0]?.id ?? ''
  const walletCurrency = (walletId: string): CurrencyCode =>
    wallets.find((w) => w.id === walletId)?.currency ?? base

  const blank = (): TxEditorDraft => ({
    type: 'spend',
    amount: '',
    category: firstCategoryOf('spend'),
    subcategory: null,
    walletId: defaultWalletId,
    goalId: null,
    date: ymd(startOfToday()),
    note: '',
    name: '',
    frequency: 'monthly',
    autopost: false,
    scopeType: 'category',
    target: firstCategoryOf('spend'),
    period: 'monthly',
    customDays: '30',
    limit: '',
    currency: base,
  })

  // --- Transactions ---
  const openAddTx = () => setEditing({ kind: 'tx', id: null, draft: blank() })
  const openEditTx = (t: LocalTransaction) =>
    setEditing({
      kind: 'tx',
      id: t.id,
      source: t.source,
      draft: {
        ...blank(),
        type: t.type,
        amount: minorToInputValue(t.amount, t.currency),
        category: t.category,
        subcategory: t.subcategory,
        walletId: t.walletId,
        goalId: t.goalId,
        date: t.date,
        note: t.note ?? '',
      },
    })

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
            : firstCategoryOf('spend')),
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
        category: 'housing',
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
      prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev,
    )

  // Switching spend/income re-defaults the category to a valid one for that type.
  const setType = (type: TxType) =>
    setEditing((prev) => {
      if (!prev) return prev
      const valid = categoriesByType(type).map((c) => c.id)
      const category = valid.includes(prev.draft.category)
        ? prev.draft.category
        : valid[0]
      return {
        ...prev,
        draft: { ...prev.draft, type, category, subcategory: null },
      }
    })

  const setCategory = (category: string) =>
    setEditing((prev) =>
      prev
        ? { ...prev, draft: { ...prev.draft, category, subcategory: null } }
        : prev,
    )

  // Choosing a goal earmarks the entry as savings toward it.
  const setGoal = (goalId: string | null) =>
    setEditing((prev) => {
      if (!prev) return prev
      const category = goalId ? SAVINGS_CATEGORY_ID : prev.draft.category
      return { ...prev, draft: { ...prev.draft, goalId, category } }
    })

  const setScopeType = (scopeType: BudgetScope) =>
    setEditing((prev) => {
      if (!prev) return prev
      const target =
        scopeType === 'category'
          ? firstCategoryOf('spend')
          : scopeType === 'wallet'
            ? defaultWalletId
            : ''
      return { ...prev, draft: { ...prev.draft, scopeType, target } }
    })

  const save = async () => {
    if (!editing) return
    const { kind, id, draft } = editing

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
        goalId: draft.type === 'spend' ? draft.goalId : null,
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
    if (editing.kind === 'tx') await deleteTransaction(editing.id)
    else if (editing.kind === 'budget') await deleteBudget(editing.id)
    else await deleteRecurring(editing.id)
    close()
  }

  return {
    editing,
    openAddTx,
    openEditTx,
    openAddBudget,
    openEditBudget,
    openAddRecurring,
    openEditRecurring,
    setField,
    setType,
    setCategory,
    setGoal,
    setScopeType,
    save,
    remove,
    close,
  }
}
