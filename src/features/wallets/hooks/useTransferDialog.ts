import { useState } from 'react'
import { db } from '#/db/db'
import type { LocalSetAside } from '#/db/types'
import { moveSetAsides } from '#/features/setAsides/data/batches'
import type { WalletSetAsideLine } from '#/features/setAsides/data/totals'
import {
  partsForPicks,
  pickHeld,
  setAsideShare,
  transferPromptText,
} from '#/features/wallets/data/setAsideMoves'
import {
  amountChips,
  autoReceived,
  doneSummary,
  previewTransfer,
  resolvePair,
} from '#/features/wallets/data/transferDialog'
import type {
  TransferDoneSummary,
  TransferWallet,
} from '#/features/wallets/data/transferDialog'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import {
  createTransfer,
  deleteTransfer,
} from '#/features/transactions/data/transfers'
import type { RatesMap } from '#/lib/config/rates'
import {
  formatMoney,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'

type Done = TransferDoneSummary & {
  transferId: string
  /** The set-asides moved with it went from this wallet to that one. */
  moved: { fromId: string; toId: string } | null
}

/** What every wallet holds set aside: its lines (by owner) and the rows behind them. */
export type WalletHoldings = {
  lines: Readonly<Record<string, WalletSetAsideLine[]>>
  rows: ReadonlyArray<LocalSetAside>
}

const today = () => ymd(startOfToday())

/**
 * The Wallets "Transfer money" dialog: open state, the form, submit and undo. Moving more than
 * the source's Free to spend asks first whether its set-asides go with the money (03 §6).
 */
export function useTransferDialog(
  wallets: TransferWallet[],
  rates: RatesMap,
  holdings: WalletHoldings,
) {
  const [open, setOpen] = useState(false)
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  // null = follow the FX suggestion; a string = the user's own figure.
  const [received, setReceived] = useState<string | null>(null)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)

  const { from, to } = resolvePair(wallets, fromId, toId)
  const fromCurrency = from?.currency ?? ''
  const toCurrency = to?.currency ?? ''
  const receivedValue =
    received ?? autoReceived(amount, fromCurrency, toCurrency, rates)
  const amountMinor = from ? parseAmountToMinor(amount, from.currency) : null
  const receivedMinor = to
    ? parseAmountToMinor(receivedValue, to.currency)
    : null
  const preview =
    from && to ? previewTransfer(from, to, amountMinor, receivedMinor) : null
  const chips = from ? amountChips(from, amountMinor) : []
  const fromLines = from ? (holdings.lines[from.id] ?? []) : []
  const share =
    from && amountMinor !== null && amountMinor > 0
      ? setAsideShare(
          from.balance,
          fromLines.reduce((sum, l) => sum + l.amount, 0),
          amountMinor,
        )
      : 0
  const picks = share > 0 ? pickHeld(fromLines, share) : []
  const prompt =
    asking && from && picks.length > 0
      ? transferPromptText(share, picks, from.currency)
      : null

  const reset = () => {
    setFromId(null)
    setToId(null)
    setAmount('')
    setReceived(null)
    setDate(today())
    setNote('')
    setDone(null)
    setAsking(false)
  }

  const openDialog = () => {
    reset()
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    reset()
  }

  const pickFrom = (id: string) => {
    setFromId(id)
    setToId(to?.id ?? null)
    setReceived(null)
  }
  const pickTo = (id: string) => {
    setFromId(from?.id ?? null)
    setToId(id)
    setReceived(null)
  }
  const swap = () => {
    setFromId(to?.id ?? null)
    setToId(from?.id ?? null)
    setReceived(null)
  }
  const changeAmount = (value: string) => {
    setAmount(value)
    setReceived(null)
  }
  const pickChip = (minor: number) => {
    if (from) changeAmount(minorToInputValue(minor, from.currency))
  }

  const submit = async () => {
    if (!from || !to || !preview?.canSubmit || amountMinor === null || busy) {
      return
    }
    if (picks.length > 0 && !asking) {
      setAsking(true)
      return
    }
    await send(false)
  }

  /** Record the transfer; with `moveHeld`, its set-asides follow it to the destination. */
  const send = async (moveHeld: boolean) => {
    if (!from || !to || !preview?.canSubmit || amountMinor === null || busy) {
      return
    }
    setBusy(true)
    try {
      const transferId = await createTransfer({
        fromWalletId: from.id,
        toWalletId: to.id,
        amount: amountMinor,
        fromCurrency: from.currency,
        toAmount: preview.received,
        toCurrency: to.currency,
        date,
        note: note.trim() || null,
      })
      const parts = moveHeld
        ? partsForPicks(holdings.rows, from.id, from.currency, picks, rates)
        : []
      if (parts.length > 0)
        await moveSetAsides(
          parts.map((p) => ({ ...p, to: { walletId: to.id } })),
          { date, transferId },
        )
      // Pin the pair so the form comes back on the same wallets after an undo.
      setFromId(from.id)
      setToId(to.id)
      setAsking(false)
      const summary = doneSummary(from, to, amountMinor, preview.received)
      setDone({
        transferId,
        moved: parts.length > 0 ? { fromId: from.id, toId: to.id } : null,
        ...summary,
        sub:
          parts.length > 0
            ? `${summary.sub} · ${formatMoney(share, from.currency)} set aside moved with it`
            : summary.sub,
      })
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!done) return
    await deleteTransfer(done.transferId)
    // The set-asides that rode on it go back where they were.
    const moved = done.moved
    if (moved) {
      const rows = await db.setAsides
        .filter(
          (a) =>
            a.movedByTransferId === done.transferId &&
            a.releasedAt === null &&
            a.walletId === moved.toId,
        )
        .toArray()
      await moveSetAsides(
        rows.map((a) => ({ id: a.id, to: { walletId: moved.fromId } })),
      )
    }
    setDone(null)
  }

  return {
    open,
    openDialog,
    close,
    wallets,
    from,
    to,
    amount,
    amountMinor,
    changeAmount,
    received: receivedValue,
    receivedMinor: preview?.received ?? 0,
    receivedEdited: received !== null,
    changeReceived: setReceived,
    resetReceived: () => setReceived(null),
    date,
    setDate,
    note,
    setNote,
    preview,
    chips,
    pickChip,
    pickFrom,
    pickTo,
    swap,
    submit,
    /** "SR 400.00 of this is set aside (…). Move those set-asides with it?" while asking. */
    prompt,
    moveThem: () => void send(true),
    leaveThem: () => void send(false),
    backToForm: () => setAsking(false),
    busy,
    done,
    undo,
  }
}

export type TransferDialogState = ReturnType<typeof useTransferDialog>
