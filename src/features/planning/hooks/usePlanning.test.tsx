// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import {
  bill,
  income,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { useMoneyFigures } from './useMoneyFigures'
import { usePlanning } from './usePlanning'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  await Promise.all(
    [
      db.balanceNodes,
      db.bills,
      db.goals,
      db.incomeStreams,
      db.plannedTransactions,
      db.setAsides,
      db.transactions,
      db.ledgerTotals,
    ].map((t) => t.clear()),
  )
  await db.balanceNodes.put(wallet({ id: 'main', amount: m(5000) }))
  await db.incomeStreams.put(
    income({ id: 'salary', amount: m(12000), day: 25, walletId: 'main' }),
  )
  await db.bills.put(
    bill({ id: 'phone', name: 'Phone', amount: m(150), nextDue: '2026-10-12' }),
  )
  await db.setAsides.put(
    setAside({
      goalId: null,
      billId: 'phone',
      occurrence: '2026-11-12',
      walletId: 'main',
      amount: m(1000),
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the planning hooks', () => {
  it('read the local DB into the Planning page’s view', async () => {
    const { result } = renderHook(() => usePlanning())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.today).toBe('2026-10-02')
    expect(result.current.calendar.kind).toBe('paycheck')
    expect(result.current.bills.phone).toMatchObject({
      state: 'not_set_aside',
      occurrence: '2026-10-12',
    })
    expect(result.current.verdict).toMatchObject({ kind: 'covered' })
  })

  it('give Wallets its three numbers and Safe to spend', async () => {
    const { result } = renderHook(() => useMoneyFigures())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.figures.header).toEqual({
      balance: m(5000),
      setAside: m(1000),
      free: m(4000),
    })
    // The phone bill (Oct 12) is due before payday and nothing is set aside for it.
    await db.plannedTransactions.put(
      planned({
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'phone',
        name: 'Phone',
        amount: m(150),
        occurrence: '2026-10-12',
      }),
    )
    await waitFor(() => expect(result.current.safe.bills.total).toBe(m(150)))
    expect(result.current.safe).toMatchObject({
      end: '2026-10-24',
      safe: m(4000 - 150),
    })
  })
})
