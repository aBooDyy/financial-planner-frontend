import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalBalanceNode } from '#/db/types'
import {
  closeRest,
  movePlanned,
  PlannedActionError,
  skipPlanned,
} from '#/features/planned/data/mutations'
import {
  effectLine,
  plannedForLine,
  primaryLabel,
} from '#/features/planned/data/confirmCopy'
import type { Effect } from '#/features/planned/data/confirmCopy'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { useConfirmPlanned } from './useConfirmPlanned'
import { activeNodes } from '#/features/wallets/data/archive'

/** The "External…" choice in the wallet select (set-asides only). */
export const EXTERNAL = '__external__'

type Form = {
  id: string
  amount: string
  source: string
  externalLabel: string
  date: string
  moveDate: string | null
}

export type ConfirmForm = ReturnType<typeof useConfirmForm>

export const plannedErrorMessage = (e: unknown): string =>
  e instanceof PlannedActionError
    ? messageForCode(`planned.${e.code}`)
    : messageForApiError(e)

/**
 * Everything the confirm dialog (1d) holds: the amount / wallet / date being entered (seeded
 * from the item's open remainder, suggested wallet and today), the live effect line, and the
 * dialog's actions. `onDone` runs after any action that settles or moves the item.
 */
export function useConfirmForm(plannedId: string | null, onDone: () => void) {
  const nodeRows = useLiveQuery(() => db.balanceNodes.toArray())
  const wallets = useMemo<LocalBalanceNode[]>(
    () => activeNodes(nodeRows ?? []).filter((n) => n.kind === 'wallet'),
    [nodeRows],
  )
  const [form, setForm] = useState<Form | null>(null)
  const chosen = wallets.find((w) => w.id === form?.source) ?? null
  const c = useConfirmPlanned(plannedId, chosen?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const item = c.item
  // Seed once per opening, as soon as the item (and the wallets) have loaded.
  if (plannedId === null && form !== null) setForm(null)
  if (item && nodeRows && (form === null || form.id !== item.id)) {
    const suggested =
      c.defaults.walletId && wallets.some((w) => w.id === c.defaults.walletId)
        ? c.defaults.walletId
        : (wallets[0]?.id ?? '')
    setForm({
      id: item.id,
      amount: minorToInputValue(c.defaults.amount, item.currency),
      source: suggested,
      externalLabel: '',
      date: c.defaults.date,
      moveDate: null,
    })
    setError(null)
  }

  const ready = item !== null && form !== null && form.id === item.id
  const currency: CurrencyCode = item?.currency ?? ''
  const amount = ready
    ? Math.max(0, parseAmountToMinor(form.amount, currency) ?? 0)
    : 0
  const isExternal = ready && form.source === EXTERNAL
  const wallet = ready ? chosen : null
  const preview = ready ? c.preview(amount, form.date) : null

  const goalCurrency = useLiveQuery(
    async () =>
      item?.goalId
        ? ((await db.goals.get(item.goalId))?.currency ?? null)
        : null,
    [item?.goalId],
  )

  const effect: Effect | null =
    item && ready
      ? effectLine({
          item,
          preview,
          wallet: wallet
            ? { name: wallet.name, currency: wallet.currency ?? currency }
            : null,
          goalCurrency: goalCurrency ?? null,
        })
      : null

  const kind = preview?.kind ?? 'empty'
  const needsSource = isExternal ? !form.externalLabel.trim() : wallet === null
  const canConfirm = ready && kind !== 'empty' && !needsSource && !busy
  const today = c.defaults.date

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (e) {
      setError(plannedErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f))

  return {
    ready,
    item,
    currency,
    settled: c.settled,
    remainder: c.remainder,
    wallets,
    form,
    amount,
    effect,
    error,
    busy,
    canConfirm,
    allowExternal: item?.role === 'set_aside',
    headerLine: item ? plannedForLine(item.date, today) : '',
    primaryLabel: item
      ? primaryLabel({
          role: item.role,
          kind,
          amount,
          currency,
          early: item.date > today,
        })
      : '',
    setAmount: (value: string) => patch({ amount: value }),
    setSource: (source: string) => patch({ source }),
    setExternalLabel: (externalLabel: string) => patch({ externalLabel }),
    setDate: (date: string) => patch({ date }),
    startMove: () => patch({ moveDate: item?.date ?? today }),
    cancelMove: () => patch({ moveDate: null }),
    setMoveDate: (moveDate: string) => patch({ moveDate }),
    confirm: () =>
      form && item
        ? run(() =>
            c.confirm({
              amount,
              walletId: isExternal ? null : (wallet?.id ?? null),
              externalLabel: isExternal ? form.externalLabel.trim() : null,
              date: form.date,
            }),
          )
        : Promise.resolve(),
    move: () =>
      form?.moveDate && item
        ? run(() => movePlanned(item.id, form.moveDate ?? item.date))
        : Promise.resolve(),
    skip: () => (item ? run(() => skipPlanned(item.id)) : Promise.resolve()),
    closeRest: () => (item ? run(() => closeRest(item.id)) : Promise.resolve()),
  }
}
