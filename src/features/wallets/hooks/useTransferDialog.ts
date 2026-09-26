import { useState } from 'react'
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
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

type Done = TransferDoneSummary & { transferId: string }

const today = () => ymd(startOfToday())

/** The Wallets "Transfer money" dialog: open state, the form, submit and undo. */
export function useTransferDialog(wallets: TransferWallet[], rates: RatesMap) {
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

  const reset = () => {
    setFromId(null)
    setToId(null)
    setAmount('')
    setReceived(null)
    setDate(today())
    setNote('')
    setDone(null)
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
      // Pin the pair so the form comes back on the same wallets after an undo.
      setFromId(from.id)
      setToId(to.id)
      setDone({
        transferId,
        ...doneSummary(from, to, amountMinor, preview.received),
      })
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!done) return
    await deleteTransfer(done.transferId)
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
    busy,
    done,
    undo,
  }
}

export type TransferDialogState = ReturnType<typeof useTransferDialog>
