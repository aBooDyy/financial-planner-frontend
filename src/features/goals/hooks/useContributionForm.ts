import { useState } from 'react'
import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import { contributionRoleOf, PlannedActionError } from '#/features/planned'
import type {
  ContributionInput,
  ContributionResult,
  GoalPlanView,
} from '#/features/planned'
import {
  contributionCopy,
  laterDefaultDate,
} from '#/features/goals/data/contribution'
import type { ContributionMode } from '#/features/goals/data/contribution'
import { startOfToday, ymd } from '#/features/goals/data/planning'
import { parseAmountToMinor } from '#/lib/currency'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

/** The "From" select's value for money held outside any wallet. */
export const EXTERNAL = '__external__'

type Options = {
  goal: LocalGoal
  plan: GoalPlanView | null
  nodes: ReadonlyArray<LocalBalanceNode>
  add: (input: ContributionInput) => Promise<ContributionResult>
  onDone: () => void
}

const errorText = (e: unknown): string =>
  e instanceof PlannedActionError
    ? messageForCode(`planned.${e.code}`)
    : messageForApiError(e)

/** State and derived copy for the 1b dialog. Mount it fresh for each opening. */
export function useContributionForm({
  goal,
  plan,
  nodes,
  add,
  onDone,
}: Options) {
  const today = startOfToday()
  const role = contributionRoleOf(goal) === 'payment' ? 'payment' : 'set_aside'
  const wallets = nodes.filter((n) => n.kind === 'wallet' && n.deleted === 0)
  const nextPlanned = plan?.nextPlanned?.date ?? null

  const [mode, setModeState] = useState<ContributionMode>('now')
  const [amount, setAmount] = useState('')
  const firstSource = wallets[0]?.id ?? (role === 'set_aside' ? EXTERNAL : '')
  const [source, setSource] = useState<string>(firstSource)
  const [externalLabel, setExternalLabel] = useState('')
  const [date, setDate] = useState(ymd(today))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowExternal = mode === 'now' && role === 'set_aside'
  const isExternal = source === EXTERNAL
  const amountMinor = Math.max(
    0,
    parseAmountToMinor(amount, goal.currency) ?? 0,
  )
  const due =
    mode === 'now'
      ? (plan?.behind.unconfirmed.find((p) => p.role === role) ?? null)
      : null

  const setMode = (next: ContributionMode) => {
    setModeState(next)
    setError(null)
    setDate(next === 'now' ? ymd(today) : laterDefaultDate(nextPlanned, today))
    if (next === 'later' && source === EXTERNAL) setSource(wallets[0]?.id ?? '')
    if (next === 'now' && !source) setSource(firstSource)
  }

  const { hint, cta } = contributionCopy({
    mode,
    amount: amountMinor,
    currency: goal.currency,
    goalName: goal.name,
    role,
    saved: plan?.progress.saved ?? 0,
    due: due
      ? {
          date: due.date,
          remainder:
            plan?.contributions.find(
              (c) => c.source === 'planned' && c.plannedId === due.id,
            )?.amount ?? due.amount,
          currency: goal.currency,
        }
      : null,
    externalLabel: isExternal ? externalLabel : null,
    date,
  })

  const hasSource =
    mode === 'later' || (isExternal ? !!externalLabel.trim() : !!source)
  const canSubmit = amountMinor > 0 && !!date && hasSource && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await add({
        mode,
        amount: amountMinor,
        walletId: isExternal || !source ? null : source,
        externalLabel: isExternal ? externalLabel.trim() : null,
        date,
      })
      onDone()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return {
    mode,
    setMode,
    amount,
    setAmount,
    source,
    setSource,
    externalLabel,
    setExternalLabel,
    date,
    setDate,
    wallets,
    allowExternal,
    isExternal,
    hint,
    cta,
    canSubmit,
    busy,
    error,
    submit,
  }
}

export type ContributionForm = ReturnType<typeof useContributionForm>
