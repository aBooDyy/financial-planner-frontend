import { useState } from 'react'
import type { LocalBalanceNode } from '#/db/types'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import { createTransfer } from '#/features/transactions/data/transfers'
import {
  suggestReceived,
  transferHint,
} from '#/features/transactions/data/transferForm'
import type { RatesMap } from '#/lib/config/rates'
import { parseAmountToMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** State for the quick-add transfer row: amount, the two wallets, and what arrives. */
export function useQuickTransfer(
  wallets: LocalBalanceNode[],
  base: CurrencyCode,
  rates: RatesMap,
) {
  const [amount, setAmount] = useState('')
  const [fromId, setFromId] = useState(() => wallets[0]?.id ?? '')
  const [toId, setToId] = useState(() => wallets[1]?.id ?? '')
  const [received, setReceived] = useState<string | null>(null)

  // Wallets may still be loading on first render; fall back until the user has picked.
  const from = fromId || (wallets[0]?.id ?? '')
  const to = toId || (wallets.find((w) => w.id !== from)?.id ?? '')

  const walletOf = (id: string) => wallets.find((w) => w.id === id)
  const fromCurrency = walletOf(from)?.currency ?? base
  const toCurrency = walletOf(to)?.currency ?? base
  const crossCurrency = fromCurrency !== toCurrency
  const receivedValue =
    received ?? suggestReceived(amount, fromCurrency, toCurrency, rates)

  const sameAccount = from !== '' && from === to
  const minor = parseAmountToMinor(amount, fromCurrency)
  const toMinor = crossCurrency
    ? parseAmountToMinor(receivedValue, toCurrency)
    : minor
  const valid =
    !sameAccount &&
    from !== '' &&
    to !== '' &&
    minor !== null &&
    minor > 0 &&
    toMinor !== null &&
    toMinor > 0

  const hint = transferHint(
    walletOf(from)?.name ?? '',
    walletOf(to)?.name ?? '',
    sameAccount,
    minor,
    fromCurrency,
  )

  const swap = () => {
    setFromId(to)
    setToId(from)
    setReceived(null)
  }
  const pickFrom = (id: string) => {
    setFromId(id)
    setReceived(null)
  }
  const pickTo = (id: string) => {
    setToId(id)
    setReceived(null)
  }
  const changeAmount = (value: string) => {
    setAmount(value)
    setReceived(null)
  }

  const add = async () => {
    if (!valid) return
    await createTransfer({
      fromWalletId: from,
      toWalletId: to,
      amount: minor,
      fromCurrency,
      toAmount: toMinor,
      toCurrency,
      date: ymd(startOfToday()),
      note: null,
    })
    setAmount('')
    setReceived(null)
  }

  return {
    amount,
    changeAmount,
    from,
    to,
    pickFrom,
    pickTo,
    swap,
    fromCurrency,
    toCurrency,
    crossCurrency,
    received: receivedValue,
    setReceived,
    sameAccount,
    valid,
    hint,
    add,
  }
}
