import { useState } from 'react'
import type { LocalGoal, LocalIncomeStream } from '#/db/types'
import type {
  GoalFrequency,
  GoalKind,
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import {
  DEFAULT_CUSTOM_INTERVAL,
  DEFAULT_CUSTOM_UNIT,
  GOAL_COLORS,
  RECURRING_KINDS,
} from '#/features/goals/constants'
import type { FreqMeta } from '#/features/goals/constants'
import {
  customFrequencyMeta,
  frequencyMetaOf,
  isValidInterval,
  repeatBlock,
  repeatDraftOf,
  repeatOfDraft,
} from '#/features/goals/data/cadence'
import type { RepeatDraft } from '#/features/goals/data/cadence'
import {
  addMonths,
  nextDueDefault,
  startOfToday,
  ymd,
} from '#/features/goals/data/planning'
import { nextPaydayOf, usesPaydayAnchor } from '#/features/goals/data/paydays'
import {
  createGoal,
  createIncome,
  deleteGoal,
  deleteIncome,
  updateGoal,
  updateIncome,
} from '#/features/goals/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

export type EditorType = 'income' | 'goal'

export type EditorDraft = {
  // shared
  name: string
  amount: string
  currency: CurrencyCode
  color: string
  // income
  frequency: GoalFrequency
  day: string
  /** Income: the wallet a payday lands in. */
  walletId: string | null
  /** Income, non-monthly: the next payday the user picked ('' = the shown default). */
  anchorISO: string
  /** Income: the stream's stored payday anchor, kept while the user does not pick another. */
  storedAnchor: string | null
  // goal
  kind: GoalKind
  saved: string
  dueISO: string
  /** Day of the month set-asides fall on; blank reads as the 1st. */
  setAsideDay: string
  /** One-time goals: also plan the payment on the due date. */
  payOnDue: boolean
  /** Recurring goals: repeat every `customInterval` `customUnit`s instead of `frequency`. */
  customRepeat: boolean
  customInterval: string
  customUnit: IntervalUnit
}

export type EditorState = {
  type: EditorType
  id: string | null
  draft: EditorDraft
  /** The draft as it opened, so closing can tell whether anything would be lost. */
  initial: EditorDraft
}

export const isEditorDirty = ({ draft, initial }: EditorState): boolean =>
  (Object.keys(draft) as Array<keyof EditorDraft>).some(
    (key) => draft[key] !== initial[key],
  )

/** The repeat a draft would save, if the custom interval it holds is usable. */
export const draftFrequencyMeta = (draft: RepeatDraft): FreqMeta => {
  const every = Number(draft.customInterval)
  return draft.customRepeat && isValidInterval(every)
    ? customFrequencyMeta(every, draft.customUnit)
    : frequencyMetaOf({ ...draft, customInterval: null, customUnit: null })
}

const defaultDueFor = (kind: GoalKind, draft: RepeatDraft): string => {
  const today = startOfToday()
  if (kind === 'openended') return ''
  if (kind === 'onetime') return ymd(addMonths(today, 12))
  return nextDueDefault(draftFrequencyMeta(draft), today)
}

/** Why the draft can't be saved yet, or null when it can. */
export const goalSaveBlocker = (draft: EditorDraft): string | null =>
  RECURRING_KINDS.includes(draft.kind) ? repeatBlock(draft) : null

type PaydayDraft = Pick<
  EditorDraft,
  'day' | 'frequency' | 'anchorISO' | 'storedAnchor'
>

const payDayOf = (draft: PaydayDraft): number =>
  Math.max(1, Math.min(31, parseInt(draft.day, 10) || 1))

/** The next payday the income editor shows: the one picked, else the stream's own next one. */
export const shownNextPayday = (draft: PaydayDraft, today: Date): string =>
  draft.anchorISO ||
  ymd(
    nextPaydayOf(
      {
        day: payDayOf(draft),
        frequency: draft.frequency,
        anchorDate: draft.storedAnchor,
      },
      today,
    ),
  )

/**
 * What an income stream saves as its pay schedule. Monthly is its day of the month alone;
 * any other cadence steps from a payday — the one picked, the one stored, else the one
 * shown — and its `day` is that payday's day of the month.
 */
export const incomeScheduleOf = (
  draft: PaydayDraft,
  today: Date,
): { day: number; anchorDate: string | null } => {
  if (!usesPaydayAnchor(draft.frequency))
    return { day: payDayOf(draft), anchorDate: null }
  const anchorDate =
    draft.anchorISO || draft.storedAnchor || shownNextPayday(draft, today)
  return { day: Number(anchorDate.slice(8, 10)), anchorDate }
}

/** Blank or out of range reads as "no preference" (the 1st). */
export const parseSetAsideDay = (value: string): number | null => {
  const day = parseInt(value, 10)
  return Number.isFinite(day) && day >= 1 && day <= 28 ? day : null
}

/** The repeat a goal of `kind` saves from the draft. */
function repeatOf(
  kind: GoalKind,
  draft: RepeatDraft,
): {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
} {
  if (!RECURRING_KINDS.includes(kind))
    return { frequency: null, customInterval: null, customUnit: null }
  return repeatOfDraft(draft)
}

export function useGoalEditor(defaultCurrency: CurrencyCode) {
  const [editing, setEditing] = useState<EditorState | null>(null)

  const baseDraft = (over: Partial<EditorDraft>): EditorDraft => ({
    name: '',
    amount: '',
    currency: defaultCurrency,
    color: GOAL_COLORS[1],
    frequency: 'monthly',
    day: '1',
    walletId: null,
    anchorISO: '',
    storedAnchor: null,
    kind: 'onetime',
    saved: '',
    dueISO: '',
    setAsideDay: '',
    payOnDue: false,
    customRepeat: false,
    customInterval: String(DEFAULT_CUSTOM_INTERVAL),
    customUnit: DEFAULT_CUSTOM_UNIT,
    ...over,
  })

  const open = (type: EditorType, id: string | null, draft: EditorDraft) =>
    setEditing({ type, id, draft, initial: draft })

  const openAddIncome = () => open('income', null, baseDraft({}))

  const openEditIncome = (s: LocalIncomeStream) =>
    open(
      'income',
      s.id,
      baseDraft({
        name: s.label,
        amount: minorToInputValue(s.amount, s.currency),
        currency: s.currency,
        color: s.color,
        frequency: s.frequency,
        day: String(s.day),
        walletId: s.walletId,
        storedAnchor: s.anchorDate ?? null,
      }),
    )

  const openAddGoal = (presetKind: GoalKind) => {
    const draft = baseDraft({
      currency: defaultCurrency,
      color: GOAL_COLORS[4],
      frequency: 'annual',
      kind: presetKind,
    })
    open('goal', null, {
      ...draft,
      dueISO: defaultDueFor(presetKind, draft),
    })
  }

  const openEditGoal = (g: LocalGoal) =>
    open(
      'goal',
      g.id,
      baseDraft({
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
        ...repeatDraftOf(g, 'annual'),
        kind: g.kind,
        saved: g.saved ? minorToInputValue(g.saved, g.currency) : '',
        dueISO: (g.kind === 'onetime' ? g.dueDate : g.nextDue) ?? '',
        setAsideDay: g.setAsideDay !== null ? String(g.setAsideDay) : '',
        payOnDue: g.payOnDue,
      }),
    )

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
      const dueISO = prev.draft.dueISO || defaultDueFor(kind, prev.draft)
      return { ...prev, draft: { ...prev.draft, kind, dueISO } }
    })

  /** Resolves with the saved goal's id (null for income or nothing to save). */
  const save = async (): Promise<string | null> => {
    if (!editing) return null
    const { type, id, draft } = editing
    const currency = draft.currency

    if (type === 'income') {
      const amount = parseAmountToMinor(draft.amount, currency) ?? 0
      const { day, anchorDate } = incomeScheduleOf(draft, startOfToday())
      const fields = {
        label: draft.name.trim() || 'Income',
        amount,
        currency,
        frequency: draft.frequency,
        day,
        anchorDate,
        color: draft.color,
        walletId: draft.walletId,
      }
      if (id) await updateIncome(id, fields)
      else await createIncome(fields)
      close()
      return null
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
      ...repeatOf(kind, draft),
      nextDue:
        kind === 'recurring' || kind === 'sinking'
          ? draft.dueISO || null
          : null,
      dueDate: kind === 'onetime' ? draft.dueISO || null : null,
      setAsideDay: parseSetAsideDay(draft.setAsideDay),
      payOnDue: kind === 'onetime' && draft.payOnDue,
    }
    const goalId = id ?? (await createGoal(goalDraft))
    if (id) await updateGoal(id, goalDraft)
    close()
    return goalId
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
    save,
    remove,
    close,
  }
}
