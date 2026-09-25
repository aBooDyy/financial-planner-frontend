import { useState } from 'react'
import {
  adjustDoneSummary,
  previewAdjustment,
} from '#/features/balances/data/adjustBalance'
import type { AdjustDoneSummary } from '#/features/balances/data/adjustBalance'
import type { TransferWallet } from '#/features/balances/data/transferDialog'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import {
  createAdjustment,
  deleteTransaction,
} from '#/features/transactions/data/mutations'
import { parseAmountToMinor } from '#/lib/currency'

type Done = AdjustDoneSummary & { transactionId: string }

const today = () => ymd(startOfToday())

/** The Balances "Adjust balance" dialog: which wallet, the real balance, submit and undo. */
export function useAdjustBalance(wallets: TransferWallet[]) {
  const [walletId, setWalletId] = useState<string | null>(null)
  const [actual, setActual] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [busy, setBusy] = useState(false)

  const wallet = wallets.find((w) => w.id === walletId)
  const targetMinor = wallet
    ? parseAmountToMinor(actual, wallet.currency)
    : null
  const preview = wallet ? previewAdjustment(wallet, targetMinor) : null

  const reset = () => {
    setActual('')
    setDate(today())
    setNote('')
    setDone(null)
  }

  const openFor = (id: string) => {
    reset()
    setWalletId(id)
  }
  const close = () => {
    setWalletId(null)
    reset()
  }

  const submit = async () => {
    if (!wallet || !preview?.adjustment || busy) return
    const { adjustment, next } = preview
    setBusy(true)
    try {
      const transactionId = await createAdjustment({
        type: adjustment.type,
        amount: adjustment.amount,
        currency: wallet.currency,
        walletId: wallet.id,
        date,
        note: note.trim() || null,
      })
      setDone({
        transactionId,
        ...adjustDoneSummary(wallet, adjustment, next),
      })
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!done) return
    await deleteTransaction(done.transactionId)
    setDone(null)
  }

  return {
    open: wallet !== undefined,
    openFor,
    close,
    wallet,
    actual,
    setActual,
    date,
    setDate,
    note,
    setNote,
    preview,
    submit,
    busy,
    done,
    undo,
  }
}

export type AdjustBalanceState = ReturnType<typeof useAdjustBalance>
