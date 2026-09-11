import { useState } from 'react'
import type {
  LocalBalanceNode,
  LocalGoal,
  LocalGoalAllocation,
  LocalIncomeStream,
} from '#/db/types'
import type {
  AllocationSource,
  GoalFrequency,
  GoalKind,
} from '#/features/goals/api/types'
import { GOAL_COLORS } from '#/features/goals/constants'
import {
  addMonths,
  nextDueDefault,
  startOfToday,
  ymd,
} from '#/features/goals/data/planning'
import {
  createAllocation,
  createGoal,
  createIncome,
  deleteAllocation,
  deleteGoal,
  deleteIncome,
  updateAllocation,
  updateGoal,
  updateIncome,
} from '#/features/goals/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

export type EditorType = 'income' | 'goal'

// One "set aside from" row in the goal editor. A wallet row reserves part of a wallet (its
// currency follows the wallet); an external row names an outside source in the goal's currency.
export type AllocationRowDraft = {
  key: string
  existingId: string | null
  source: AllocationSource
  walletId: string | null
  externalLabel: string
  amount: string
  currency: CurrencyCode
}

export type EditorDraft = {
  // shared
  name: string
  amount: string
  currency: CurrencyCode
  color: string
  // income
  frequency: GoalFrequency
  day: string
  // goal
  kind: GoalKind
  saved: string
  dueISO: string
  allocations: AllocationRowDraft[]
}

export type EditorState = {
  type: EditorType
  id: string | null
  draft: EditorDraft
}

const defaultDueFor = (kind: GoalKind, freq: GoalFrequency): string => {
  const today = startOfToday()
  if (kind === 'openended') return ''
  if (kind === 'onetime') return ymd(addMonths(today, 12))
  return nextDueDefault(freq, today)
}

const tempKey = (() => {
  let n = 0
  return () => `new-${n++}`
})()

export function useGoalEditor(
  defaultCurrency: CurrencyCode,
  nodes: LocalBalanceNode[],
  allAllocations: LocalGoalAllocation[],
) {
  const [editing, setEditing] = useState<EditorState | null>(null)

  const walletCurrency = (walletId: string | null): CurrencyCode | null => {
    if (!walletId) return null
    const node = nodes.find((n) => n.id === walletId && n.kind === 'wallet')
    return node?.currency ?? null
  }

  const rowsForGoal = (goalId: string): AllocationRowDraft[] =>
    allAllocations
      .filter((a) => a.goalId === goalId)
      .sort((a, b) => a.position - b.position)
      .map((a) => ({
        key: a.id,
        existingId: a.id,
        source: a.source,
        walletId: a.walletId,
        externalLabel: a.externalLabel ?? '',
        amount: minorToInputValue(a.amount, a.currency),
        currency: a.currency,
      }))

  const baseDraft = (over: Partial<EditorDraft>): EditorDraft => ({
    name: '',
    amount: '',
    currency: defaultCurrency,
    color: GOAL_COLORS[1],
    frequency: 'monthly',
    day: '1',
    kind: 'onetime',
    saved: '',
    dueISO: '',
    allocations: [],
    ...over,
  })

  const openAddIncome = () =>
    setEditing({ type: 'income', id: null, draft: baseDraft({}) })

  const openEditIncome = (s: LocalIncomeStream) =>
    setEditing({
      type: 'income',
      id: s.id,
      draft: baseDraft({
        name: s.label,
        amount: minorToInputValue(s.amount, s.currency),
        currency: s.currency,
        color: s.color,
        frequency: s.frequency,
        day: String(s.day),
      }),
    })

  const openAddGoal = (presetKind: GoalKind) =>
    setEditing({
      type: 'goal',
      id: null,
      draft: baseDraft({
        currency: defaultCurrency,
        color: GOAL_COLORS[4],
        frequency: 'annual',
        kind: presetKind,
        dueISO: defaultDueFor(presetKind, 'annual'),
      }),
    })

  const openEditGoal = (g: LocalGoal) =>
    setEditing({
      type: 'goal',
      id: g.id,
      draft: baseDraft({
        name: g.name,
        amount:
          g.kind === 'onetime'
            ? g.target !== null
              ? minorToInputValue(g.target, g.currency)
              : ''
            : g.amount !== null
              ? minorToInputValue(g.amount, g.currency)
              : '',
        currency: g.currency,
        color: g.color,
        frequency: g.frequency ?? 'annual',
        kind: g.kind,
        saved: g.saved ? minorToInputValue(g.saved, g.currency) : '',
        dueISO: (g.kind === 'onetime' ? g.dueDate : g.nextDue) ?? '',
        allocations: rowsForGoal(g.id),
      }),
    })

  const close = () => setEditing(null)

  const setField = <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) =>
    setEditing((prev) =>
      prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev,
    )

  // Switching a new goal's type re-defaults the due date if the user hasn't set one.
  const setKind = (kind: GoalKind) =>
    setEditing((prev) => {
      if (!prev) return prev
      const dueISO =
        prev.draft.dueISO || defaultDueFor(kind, prev.draft.frequency)
      return { ...prev, draft: { ...prev.draft, kind, dueISO } }
    })

  // --- Allocation rows ---------------------------------------------------------------

  const setAllocations = (
    update: (rows: AllocationRowDraft[]) => AllocationRowDraft[],
  ) =>
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              allocations: update(prev.draft.allocations),
            },
          }
        : prev,
    )

  const addAllocationRow = () =>
    setEditing((prev) => {
      if (!prev) return prev
      // Default to the first wallet if there is one, else an external source.
      const firstWallet = nodes.find((n) => n.kind === 'wallet')
      const row: AllocationRowDraft = firstWallet
        ? {
            key: tempKey(),
            existingId: null,
            source: 'wallet',
            walletId: firstWallet.id,
            externalLabel: '',
            amount: '',
            currency: firstWallet.currency ?? prev.draft.currency,
          }
        : {
            key: tempKey(),
            existingId: null,
            source: 'external',
            walletId: null,
            externalLabel: '',
            amount: '',
            currency: prev.draft.currency,
          }
      return {
        ...prev,
        draft: { ...prev.draft, allocations: [...prev.draft.allocations, row] },
      }
    })

  const removeAllocationRow = (key: string) =>
    setAllocations((rows) => rows.filter((r) => r.key !== key))

  /** Pick a source for a row: a wallet id, or `'external'`. Resets currency accordingly. */
  const setAllocationSource = (key: string, value: string) =>
    setAllocations((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r
        if (value === 'external') {
          return {
            ...r,
            source: 'external',
            walletId: null,
            currency: editing?.draft.currency ?? r.currency,
          }
        }
        return {
          ...r,
          source: 'wallet',
          walletId: value,
          currency: walletCurrency(value) ?? r.currency,
        }
      }),
    )

  const setAllocationField = (
    key: string,
    field: 'amount' | 'externalLabel',
    value: string,
  ) =>
    setAllocations((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    )

  // --- Persistence -------------------------------------------------------------------

  /** Diff the editor's allocation rows against what's stored, then create/update/delete. */
  const persistAllocations = async (
    goalId: string,
    rows: AllocationRowDraft[],
  ): Promise<void> => {
    const existing = allAllocations.filter((a) => a.goalId === goalId)
    const kept = new Set<string>()
    for (const row of rows) {
      const amount = parseAmountToMinor(row.amount, row.currency) ?? 0
      const isWallet = row.source === 'wallet'
      // Skip rows that can't be saved (no amount, or missing wallet/label).
      if (amount <= 0) continue
      if (isWallet && !row.walletId) continue
      if (!isWallet && !row.externalLabel.trim()) continue
      const draft = {
        goalId,
        source: row.source,
        walletId: isWallet ? row.walletId : null,
        externalLabel: isWallet ? null : row.externalLabel.trim(),
        amount,
        currency: row.currency,
        note: null,
      }
      if (row.existingId) {
        kept.add(row.existingId)
        await updateAllocation(row.existingId, draft)
      } else {
        await createAllocation(draft)
      }
    }
    for (const a of existing) {
      if (!kept.has(a.id)) await deleteAllocation(a.id)
    }
  }

  const save = async () => {
    if (!editing) return
    const { type, id, draft } = editing
    const currency = draft.currency

    if (type === 'income') {
      const amount = parseAmountToMinor(draft.amount, currency) ?? 0
      const day = Math.max(1, Math.min(31, parseInt(draft.day, 10) || 1))
      const fields = {
        label: draft.name.trim() || 'Income',
        amount,
        currency,
        frequency: draft.frequency,
        day,
        color: draft.color,
      }
      if (id) await updateIncome(id, fields)
      else await createIncome(fields)
      close()
      return
    }

    const kind = draft.kind
    const amountMinor = parseAmountToMinor(draft.amount, currency) ?? 0
    const savedMinor = parseAmountToMinor(draft.saved, currency) ?? 0
    const goalDraft = {
      kind,
      name: draft.name.trim() || 'Untitled',
      currency,
      color: draft.color,
      amount: kind === 'onetime' ? null : amountMinor,
      target: kind === 'onetime' ? amountMinor : null,
      saved: savedMinor,
      frequency:
        kind === 'recurring' || kind === 'sinking' ? draft.frequency : null,
      nextDue:
        kind === 'recurring' || kind === 'sinking'
          ? draft.dueISO || null
          : null,
      dueDate: kind === 'onetime' ? draft.dueISO || null : null,
    }
    const goalId = id ?? (await createGoal(goalDraft))
    if (id) await updateGoal(id, goalDraft)
    await persistAllocations(goalId, draft.allocations)
    close()
  }

  const remove = async () => {
    if (!editing?.id) return
    if (editing.type === 'income') await deleteIncome(editing.id)
    else await deleteGoal(editing.id)
    close()
  }

  return {
    editing,
    openAddIncome,
    openEditIncome,
    openAddGoal,
    openEditGoal,
    setKind,
    setField,
    addAllocationRow,
    removeAllocationRow,
    setAllocationSource,
    setAllocationField,
    save,
    remove,
    close,
  }
}
