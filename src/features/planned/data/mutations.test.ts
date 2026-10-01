import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import {
  catId,
  defaultCatalog,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { goalProgress } from '#/features/goals/data/progress'
import {
  createSetAside,
  deleteSetAside,
} from '#/features/setAsides/data/mutations'
import {
  createTransaction,
  deleteTransaction,
} from '#/features/transactions/data/mutations'
import { walletDeltas } from '#/features/transactions/data/ledger'
import {
  buildBudgetsView,
  buildCashflow,
} from '#/features/transactions/data/selectors'
import { periodOf } from '#/features/transactions/data/planning'
import {
  bill,
  goal,
  income as stream,
  m,
  planned,
  wallet,
} from '#/features/planned/testing/fixtures'
import {
  PlannedActionError,
  addContribution,
  closeRest,
  confirmPlanned,
  editPlannedAmount,
  movePlanned,
  reopenPlanned,
  skipPlanned,
} from './mutations'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const MAIN = wallet({ id: 'w1', name: 'Main Checking', currency: 'SAR' })
const UMRAH = goal({
  id: 'umrah',
  name: 'Umrah trip',
  target: m(13000),
  dueDate: '2027-03-01',
})
const SEP_SET_ASIDE = planned({
  id: 'sep',
  goalId: 'umrah',
  name: 'Umrah trip set-aside',
  occurrence: '2026-09-01',
  amount: m(1500),
})

const item = (id: string) => db.plannedTransactions.get(id)
const txOf = (plannedId: string) =>
  db.transactions.where('plannedId').equals(plannedId).toArray()
const setAsidesOf = (plannedId: string) =>
  db.setAsides.where('plannedId').equals(plannedId).toArray()

beforeEach(async () => {
  await Promise.all(
    [
      db.plannedTransactions,
      db.transactions,
      db.setAsides,
      db.goals,
      db.bills,
      db.incomeStreams,
      db.balanceNodes,
      db.categories,
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.put(MAIN)
  await db.goals.put(UMRAH)
  await db.plannedTransactions.put(SEP_SET_ASIDE)
})

describe('confirmPlanned', () => {
  it('turns a set-aside into a dated set-aside record linked back to it, and closes it', async () => {
    const result = await confirmPlanned('sep', {
      walletId: 'w1',
      date: '2026-09-24',
    })

    expect(result).toMatchObject({ kind: 'setAside', status: 'done' })
    const [reservation] = await setAsidesOf('sep')
    expect(reservation).toMatchObject({
      goalId: 'umrah',
      source: 'wallet',
      walletId: 'w1',
      amount: m(1500),
      date: '2026-09-24',
      plannedId: 'sep',
    })
    expect((await item('sep'))?.status).toBe('done')
    // A set-aside labels money in place; it is not a spend.
    expect(await db.transactions.count()).toBe(0)
    const queued = await db.outbox.toArray()
    expect(queued.map((e) => [e.entity, e.op])).toEqual([
      ['setAside', 'create'],
      ['planned', 'update'],
    ])
  })

  it('keeps a partial open with its remainder', async () => {
    await confirmPlanned('sep', { walletId: 'w1', amount: m(1000) })
    expect((await item('sep'))?.status).toBe('open')

    // The next confirm defaults to what is still open.
    await confirmPlanned('sep', { walletId: 'w1' })
    // Rows come back in primary-key (random uuid) order; compare them as a set.
    const reservations = await setAsidesOf('sep')
    expect(reservations.map((a) => a.amount).sort((a, b) => b - a)).toEqual([
      m(1000),
      m(500),
    ])
    expect((await item('sep'))?.status).toBe('done')
  })

  it('closes on an overpayment, and the excess still counts to the goal', async () => {
    await confirmPlanned('sep', { walletId: 'w1', amount: m(2000) })
    expect((await item('sep'))?.status).toBe('done')
    const progress = goalProgress(
      [UMRAH],
      await db.setAsides.toArray(),
      [],
      {},
    ).umrah!
    expect(progress.progress).toBe(m(2000))
  })

  it('holds a set-aside outside any wallet when an external source is named', async () => {
    await confirmPlanned('sep', { externalLabel: 'Dad’s help' })
    const [reservation] = await setAsidesOf('sep')
    expect(reservation).toMatchObject({
      source: 'outside',
      walletId: null,
      externalLabel: 'Dad’s help',
      currency: 'SAR',
    })
  })

  it('records a payday as income into its wallet', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'payday',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        walletId: 'w1',
        name: 'Salary',
        amount: m(12000),
        occurrence: '2026-09-27',
      }),
    )
    const result = await confirmPlanned('payday')
    const [income] = await txOf('payday')
    expect(result.kind).toBe('transaction')
    expect(income).toMatchObject({
      type: 'income',
      amount: m(12000),
      walletId: 'w1',
      goalId: null,
      categoryId: catId('salary'),
      plannedId: 'payday',
    })
  })

  it('files an entry under its type’s fallback when the category it names is of the other type', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'payday',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        walletId: 'w1',
        amount: m(12000),
        occurrence: '2026-09-27',
      }),
    )
    await confirmPlanned('payday', { categoryId: catId('housing') })
    const [income] = await txOf('payday')
    expect(income.categoryId).toBe(catId('salary'))
  })

  it('files a payday under its stream’s own category', async () => {
    await db.incomeStreams.put(
      stream({ id: 'salary', categoryId: catId('other_income') }),
    )
    await db.plannedTransactions.put(
      planned({
        id: 'payday',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        walletId: 'w1',
        amount: m(12000),
        occurrence: '2026-09-27',
      }),
    )
    await confirmPlanned('payday')
    const [income] = await txOf('payday')
    expect(income.categoryId).toBe(catId('other_income'))
  })

  it('files a payday under the income fallback when the user has no Salary category', async () => {
    await db.categories.bulkDelete([catId('salary')])
    await db.plannedTransactions.put(
      planned({
        id: 'payday',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        walletId: 'w1',
        amount: m(12000),
        occurrence: '2026-09-27',
      }),
    )
    await confirmPlanned('payday')
    const [income] = await txOf('payday')
    expect(income.categoryId).toBe(catId('other_income'))
  })

  it('records a bill payment as a spend for the bill, in the bill’s category and merchant', async () => {
    await db.bills.put(
      bill({ id: 'rent', merchantId: 'm-landlord', note: 'Flat 4' }),
    )
    await db.plannedTransactions.put(
      planned({
        id: 'rent-oct',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        name: 'Rent',
        amount: m(3500),
        occurrence: '2026-10-01',
      }),
    )
    await confirmPlanned('rent-oct', { walletId: 'w1' })
    const [payment] = await txOf('rent-oct')
    expect(payment).toMatchObject({
      type: 'spend',
      goalId: null,
      billId: 'rent',
      merchantId: 'm-landlord',
      note: 'Flat 4',
      categoryId: catId('housing'),
      plannedId: 'rent-oct',
    })
  })

  it('puts a bill’s set-aside toward the occurrence it covers', async () => {
    await db.bills.put(bill({ id: 'rent' }))
    await db.plannedTransactions.put(
      planned({
        id: 'rent-save',
        origin: 'bill',
        role: 'set_aside',
        goalId: null,
        billId: 'rent',
        amount: m(1000),
        occurrence: '2026-11-01',
      }),
    )
    await confirmPlanned('rent-save', { walletId: 'w1' })
    const [row] = await setAsidesOf('rent-save')
    expect(row).toMatchObject({
      goalId: null,
      billId: 'rent',
      occurrence: '2026-11-01',
      amount: m(1000),
    })
  })

  it('refuses a set-aside whose bill or goal is gone', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'orphan',
        origin: 'bill',
        role: 'set_aside',
        goalId: null,
        billId: 'gone',
        walletId: 'w1',
      }),
    )
    await expect(confirmPlanned('orphan')).rejects.toMatchObject({
      code: 'origin_gone',
    })
  })

  it('asks for a wallet when the item has none', async () => {
    await expect(confirmPlanned('sep')).rejects.toBeInstanceOf(
      PlannedActionError,
    )
    await expect(confirmPlanned('sep')).rejects.toMatchObject({
      code: 'no_wallet',
    })
  })

  it('moves a repeating bill past the occurrence it paid', async () => {
    await db.bills.put(
      bill({ id: 'gym', nextDue: '2026-09-05', walletId: 'w1' }),
    )
    await db.plannedTransactions.put(
      planned({
        id: 'gym-sep',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'gym',
        walletId: 'w1',
        amount: m(200),
        occurrence: '2026-09-05',
      }),
    )
    await confirmPlanned('gym-sep')
    expect((await db.bills.get('gym'))?.nextDue).toBe('2026-10-05')
  })
})

describe('re-opening when a settlement goes away', () => {
  it('re-opens a done item when its transaction is deleted', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'payday',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        walletId: 'w1',
        amount: m(12000),
      }),
    )
    const { settlementId } = await confirmPlanned('payday')
    expect((await item('payday'))?.status).toBe('done')

    await deleteTransaction(settlementId)

    expect((await item('payday'))?.status).toBe('open')
  })

  it('re-opens a done set-aside when its set-aside record is deleted', async () => {
    const { settlementId } = await confirmPlanned('sep', { walletId: 'w1' })
    await deleteSetAside(settlementId)
    expect((await item('sep'))?.status).toBe('open')
  })

  it('closes an item when an ordinary entry is saved against it (the “Counts toward” path)', async () => {
    await db.plannedTransactions.put(
      planned({
        id: 'rent-oct',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        amount: m(3500),
        occurrence: '2026-10-01',
      }),
    )
    await createTransaction({
      type: 'spend',
      amount: m(3500),
      currency: 'SAR',
      categoryId: catId('housing'),
      walletId: 'w1',
      goalId: null,
      billId: 'rent',
      date: '2026-09-30',
      note: null,
      plannedId: 'rent-oct',
    })
    expect((await item('rent-oct'))?.status).toBe('done')
  })

  it('closes a set-aside when a set-aside record is saved against it', async () => {
    await createSetAside(
      { goalId: 'umrah' },
      {
        source: 'wallet',
        walletId: 'w1',
        externalLabel: null,
        amount: m(1500),
        currency: 'SAR',
        note: null,
        plannedId: 'sep',
      },
    )
    expect((await item('sep'))?.status).toBe('done')
  })
})

describe('skip / close the rest / move / edit amount', () => {
  it('skips an item nothing settles', async () => {
    await skipPlanned('sep')
    expect((await item('sep'))?.status).toBe('skipped')
    await reopenPlanned('sep')
    expect((await item('sep'))?.status).toBe('open')
  })

  it('refuses to skip an item something settles — close the rest instead', async () => {
    await confirmPlanned('sep', { walletId: 'w1', amount: m(500) })
    await expect(skipPlanned('sep')).rejects.toMatchObject({
      code: 'has_settlements',
    })
    await closeRest('sep')
    expect((await item('sep'))?.status).toBe('done')
  })

  it('moves the date, pins it, and keeps the occurrence that identifies it', async () => {
    await movePlanned('sep', '2026-09-30')
    expect(await item('sep')).toMatchObject({
      date: '2026-09-30',
      occurrence: '2026-09-01',
      pinned: true,
    })
  })

  it('pins an edited amount', async () => {
    await editPlannedAmount('sep', m(1200))
    expect(await item('sep')).toMatchObject({ amount: m(1200), pinned: true })
  })

  it('refuses actions on an item that is no longer open', async () => {
    await skipPlanned('sep')
    await expect(
      confirmPlanned('sep', { walletId: 'w1' }),
    ).rejects.toMatchObject({ code: 'not_open' })
  })
})

describe('addContribution', () => {
  it('“Paid now” settles the goal’s oldest due item', async () => {
    const result = await addContribution('umrah', {
      mode: 'now',
      amount: m(1500),
      walletId: 'w1',
      date: '2026-09-24',
    })
    expect(result).toMatchObject({ kind: 'settled', plannedId: 'sep' })
    expect((await item('sep'))?.status).toBe('done')
  })

  it('“Paid now” with nothing due writes an unlinked set-aside', async () => {
    await skipPlanned('sep')
    const result = await addContribution('umrah', {
      mode: 'now',
      amount: m(700),
      walletId: 'w1',
      date: '2026-09-24',
    })
    expect(result).toMatchObject({ kind: 'settled', plannedId: null })
    const [row] = await db.setAsides.toArray()
    expect(row).toMatchObject({ amount: m(700), plannedId: null })
  })

  it('“Plan for later” writes a hand-made planned item', async () => {
    const result = await addContribution('umrah', {
      mode: 'later',
      amount: m(1000),
      walletId: 'w1',
      date: '2026-10-15',
    })
    expect(result.kind).toBe('planned')
    const row =
      result.kind === 'planned' ? await item(result.plannedId) : undefined
    expect(row).toMatchObject({
      origin: 'manual',
      role: 'set_aside',
      goalId: 'umrah',
      amount: m(1000),
      occurrence: '2026-10-15',
      status: 'open',
    })
  })
})

describe('planned rows never touch the ledger’s totals', () => {
  it('leaves wallet deltas, cashflow and budgets alone — before and after a set-aside confirm', async () => {
    const catalog = defaultCatalog()
    const payday = planned({
      id: 'payday',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 'salary',
      walletId: 'w1',
      amount: m(12000),
      occurrence: '2026-09-10',
    })
    await db.plannedTransactions.put(payday)
    await db.budgets.put({
      id: 'b1',
      scopeType: 'overall',
      categoryId: null,
      walletId: null,
      period: 'monthly',
      customDays: null,
      limit: m(5000),
      currency: 'SAR',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    })
    const totals = async () => {
      const data = {
        txns: await db.transactions.toArray(),
        budgets: await db.budgets.toArray(),
        nodes: [MAIN],
        base: 'SAR',
        rates: {},
      }
      const cash = buildCashflow(
        data,
        catalog,
        { type: 'all' },
        periodOf(new Date(2026, 8, 1), 'month'),
      )
      const budgets = buildBudgetsView(
        data,
        catalog,
        { type: 'all' },
        new Date(2026, 8, 24),
      )
      return {
        deltas: walletDeltas([MAIN], data.txns, {}),
        cash: [cash.incomeStr, cash.spentStr, cash.savedStr, cash.txCount],
        budgets: budgets.rows.map((r) => r.spentStr),
      }
    }

    const untouched = await totals()
    expect(untouched.deltas).toEqual({})
    expect(untouched.cash[3]).toBe(0)

    await confirmPlanned('sep', { walletId: 'w1' })
    expect(await totals()).toEqual(untouched)
  })
})
