import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { walletLiveBalances } from '#/features/transactions/data/ledger'
import {
  bill,
  m,
  planned,
  tx,
  wallet,
} from '#/features/planned/testing/fixtures'
import { previewConfirm } from './preview'
import { loadPlannerInputs } from './runner'
import { derivePlannerState, liveInputs } from './state'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const TODAY = new Date(2026, 8, 24)
const USER = 'u1'
const MAIN = wallet({ id: 'w1', name: 'Main Checking', amount: m(20000) })

const SALARY = planned({
  id: 'pay',
  origin: 'income',
  role: 'income',
  goalId: null,
  incomeStreamId: 's1',
  walletId: 'w1',
  amount: m(12000),
  occurrence: '2026-09-24',
})
const RENT = planned({
  id: 'rent-sep',
  origin: 'bill',
  goalId: null,
  billId: 'rent',
  role: 'payment',
  walletId: 'w1',
  amount: m(3000),
  occurrence: '2026-09-24',
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.balanceNodes.put(MAIN)
  await db.bills.put(
    bill({ id: 'rent', amount: m(3000), nextDue: '2026-09-24' }),
  )
  await db.plannedTransactions.bulkPut([SALARY, RENT])
  await db.transactions.bulkPut([
    tx({ billId: 'rent', plannedId: 'rent-aug', amount: m(3000) }),
    tx({ amount: m(35) }),
    tx({ type: 'income', amount: m(500) }),
    tx({ type: 'transfer_out', transferId: 'x1', amount: m(70) }),
    tx({ type: 'transfer_in', transferId: 'x2', amount: m(40) }),
    tx({ type: 'adjustment_in', amount: m(10) }),
    tx({ type: 'adjustment_out', amount: m(5) }),
    tx({ amount: m(999), deleted: 1 }),
    tx({ walletId: 'w2', amount: m(1000) }),
  ])
})

/** The preview as it was computed from a full-table read of the ledger. */
async function fromFullRead(item: typeof SALARY) {
  const narrowed = await loadPlannerInputs()
  const inputs = liveInputs({
    ...narrowed,
    txns: await db.transactions.toArray(),
  })
  return previewConfirm({
    inputs,
    state: derivePlannerState(inputs, USER, TODAY),
    nodes: [MAIN],
    userId: USER,
    today: TODAY,
    item,
    amount: item.amount,
    walletId: 'w1',
    walletTxns: inputs.txns,
    date: '2026-09-24',
  })
}

async function fromLinkedRead(item: typeof SALARY) {
  const inputs = await loadPlannerInputs()
  return previewConfirm({
    inputs,
    state: derivePlannerState(inputs, USER, TODAY),
    nodes: [MAIN],
    userId: USER,
    today: TODAY,
    item,
    amount: item.amount,
    walletId: 'w1',
    walletTxns: await db.transactions.where('walletId').equals('w1').toArray(),
    date: '2026-09-24',
  })
}

describe('previewConfirm', () => {
  it("takes the wallet line from the wallet's whole ledger, as a full read did", async () => {
    const all = await db.transactions.toArray()
    const now = walletLiveBalances([MAIN], all, {}).w1
    // 20,000 − 3,000 − 35 + 500 − 70 + 40 + 10 − 5
    expect(now).toBe(m(17440))

    const income = await fromLinkedRead(SALARY)
    expect(income.wallet).toEqual({ id: 'w1', balanceAfter: m(29440) })
    expect(income).toEqual(await fromFullRead(SALARY))

    const payment = await fromLinkedRead(RENT)
    expect(payment.wallet).toEqual({ id: 'w1', balanceAfter: m(14440) })
    // A bill's payment has no goal line.
    expect(payment.goal).toBeNull()
    expect(payment).toEqual(await fromFullRead(RENT))
  })

  it("holds the wallet line back until the wallet's ledger is read", async () => {
    const inputs = await loadPlannerInputs()
    const preview = previewConfirm({
      inputs,
      state: derivePlannerState(inputs, USER, TODAY),
      nodes: [MAIN],
      userId: USER,
      today: TODAY,
      item: SALARY,
      amount: SALARY.amount,
      walletId: 'w1',
      walletTxns: undefined,
      date: '2026-09-24',
    })
    expect(preview.kind).toBe('full')
    expect(preview.wallet).toBeNull()
  })
})
