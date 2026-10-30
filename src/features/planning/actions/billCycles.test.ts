import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { reopenPlanned } from '#/features/planned/data/mutations'
import { plannedIdFor } from '#/features/planned/data/ids'
import { bill, m, setAside, wallet } from '#/features/planned/testing/fixtures'
import { removeTransaction } from '#/features/transactions/data/billPayments'
import {
  editSetAside,
  removeSetAside,
  setAsideAgain,
  takeBackSetAside,
} from './setAsideEdit'
import { payBill, setOccurrenceAmount, skipOccurrence } from './payBill'
import { useSessionStore } from '#/stores/session'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const rowId = (occurrence: string) =>
  plannedIdFor('u1', 'bill', 'b', 'payment', occurrence)
const paymentRow = (occurrence: string) =>
  db.plannedTransactions.get(rowId(occurrence))

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  useSessionStore.setState({ user: { id: 'u1' } } as never)
  await db.balanceNodes.put(wallet({ id: 'main', amount: m(5000) }))
  await db.bills.put(
    bill({
      id: 'b',
      amount: m(400),
      frequency: 'monthly',
      nextDue: '2026-10-15',
      walletId: 'main',
      version: 'v',
    }),
  )
})

describe('paying an old cycle', () => {
  it('records it dated when it was paid, leaving nextDue alone', async () => {
    const result = await payBill('b', {
      occurrence: '2026-07-15',
      walletId: 'main',
      date: '2026-07-20',
    })
    expect(result.status).toBe('done')
    expect((await paymentRow('2026-07-15'))?.status).toBe('done')
    expect((await db.transactions.get(result.transactionId))?.date).toBe(
      '2026-07-20',
    )
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-10-15')
  })

  it('closes an old cycle paid in part: nothing more is owed on it', async () => {
    const result = await payBill('b', {
      occurrence: '2026-07-15',
      amount: m(100),
      walletId: 'main',
    })
    expect(result.status).toBe('done')
    expect((await paymentRow('2026-07-15'))?.status).toBe('done')
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-10-15')
  })

  it('pays a skipped cycle after all', async () => {
    await skipOccurrence('b', '2026-10-15')
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-11-15')
    await payBill('b', { occurrence: '2026-10-15', walletId: 'main' })
    expect((await paymentRow('2026-10-15'))?.status).toBe('done')
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-11-15')
  })

  it('undoes a skip back to the next one due', async () => {
    await skipOccurrence('b', '2026-10-15')
    await reopenPlanned(rowId('2026-10-15'))
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-10-15')
  })

  it('refuses a date off the schedule and a cycle already paid', async () => {
    await expect(
      payBill('b', { occurrence: '2026-07-16', walletId: 'main' }),
    ).rejects.toMatchObject({ code: 'bad_occurrence' })
    await payBill('b', { occurrence: '2026-07-15', walletId: 'main' })
    await expect(
      payBill('b', { occurrence: '2026-07-15', walletId: 'main' }),
    ).rejects.toMatchObject({ code: 'closed' })
  })
})

describe('a bill whose amount varies', () => {
  beforeEach(async () => {
    await db.bills.update('b', { amountVaries: true })
  })

  it.each([
    ['less', 350],
    ['more', 470],
  ])('settles the date when %s than the estimate is paid', async (_, paid) => {
    const result = await payBill('b', { amount: m(paid), walletId: 'main' })
    expect(result.status).toBe('done')
    expect(await paymentRow('2026-10-15')).toMatchObject({
      status: 'done',
      amount: m(paid),
    })
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-11-15')
  })

  it('goes back to the estimate and steps back when the payment goes', async () => {
    const { transactionId } = await payBill('b', {
      amount: m(350),
      walletId: 'main',
    })
    await removeTransaction(transactionId)
    expect(await paymentRow('2026-10-15')).toMatchObject({
      status: 'open',
      amount: m(400),
      pinned: false,
    })
    expect((await db.bills.get('b'))?.nextDue).toBe('2026-10-15')
  })

  it('takes one date its own amount', async () => {
    await setOccurrenceAmount('b', '2026-11-15', m(430))
    expect(await paymentRow('2026-11-15')).toMatchObject({
      amount: m(430),
      pinned: true,
      status: 'open',
    })
  })
})

it('a fixed bill still stays open on a part payment', async () => {
  const result = await payBill('b', { amount: m(100), walletId: 'main' })
  expect(result.status).toBe('open')
  expect((await db.bills.get('b'))?.nextDue).toBe('2026-10-15')
})

describe('changing a set-aside by hand', () => {
  beforeEach(async () => {
    await db.setAsides.put(
      setAside({
        id: 's',
        goalId: null,
        billId: 'b',
        occurrence: '2026-10-15',
        walletId: 'main',
        amount: m(200),
      }),
    )
  })

  it('edits it', async () => {
    await editSetAside('s', { amount: m(250), date: '2026-10-01' })
    expect(await db.setAsides.get('s')).toMatchObject({
      amount: m(250),
      date: '2026-10-01',
    })
  })

  it('takes it back keeping the record, and sets it aside again', async () => {
    await takeBackSetAside('s')
    expect((await db.setAsides.get('s'))?.releasedAt).not.toBeNull()
    await setAsideAgain('s')
    expect((await db.setAsides.get('s'))?.releasedAt).toBeNull()
  })

  it('deletes it', async () => {
    await removeSetAside('s')
    expect(await db.setAsides.get('s')).toBeUndefined()
  })
})
