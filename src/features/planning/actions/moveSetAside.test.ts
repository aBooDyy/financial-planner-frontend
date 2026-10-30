import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { MoveWire } from '#/features/setAsides/api/types'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { takePlanRecalcRequests } from '#/features/planned/data/recalcRequests'
import {
  bill,
  goal,
  m,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { historyOf } from '#/features/planning/view/history'
import type { RebalanceMove } from '#/features/planning/view/rebalance'
import { setAsideStateOf } from '#/features/planning/view/setAsideState'
import { MoneyActionError } from './errors'
import { applyRebalance, moveHeldTo, moveSetAsideTo } from './moveSetAside'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const NAMES: Record<string, string> = {
  bank: 'Bank',
  savings: 'Savings',
  dollars: 'Dollars',
  cash: 'Cash',
}

const rows = () => db.setAsides.toArray()
const live = async () => (await rows()).filter(isLiveSetAside)
const held = async () =>
  (await live()).map((a) => [a.walletId, a.amount, a.currency])
const code = async (work: Promise<unknown>) => {
  const error = await work.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(MoneyActionError)
  return (error as MoneyActionError).code
}
const story = async () =>
  historyOf({
    kind: 'goal',
    id: 'g',
    currency: 'SAR',
    txns: [],
    setAsides: await rows(),
    planned: [],
    walletName: (id) => (id ? NAMES[id] : 'No wallet'),
    categoryName: () => null,
    rates: { SAR: 1, USD: 3.75 },
  }).map((l) => [l.label, l.sub, l.amount])
const stateOf = async (id: string) => {
  const all = await rows()
  return setAsideStateOf(all.find((a) => a.id === id) as (typeof all)[0], all)
}

const HELD = setAside({
  id: 'held',
  goalId: 'g',
  walletId: 'bank',
  amount: m(300),
  plannedId: 'p1',
  date: '2026-09-01',
  createdAt: '2026-09-01T08:00:00.000Z',
})

beforeEach(async () => {
  await Promise.all(
    [
      db.setAsides,
      db.bills,
      db.goals,
      db.balanceNodes,
      db.exchangeRates,
      db.outbox,
    ].map((t) => t.clear()),
  )
  await db.exchangeRates.bulkPut(
    [
      { currency: 'SAR', rate: 1 },
      { currency: 'USD', rate: 3.75 },
    ].map((r) => ({ ...r, version: 'v', updatedAt: '', dirty: 0 })),
  )
  await db.balanceNodes.bulkPut([
    wallet({ id: 'bank' }),
    wallet({ id: 'savings' }),
    wallet({ id: 'dollars', currency: 'USD' }),
    wallet({ id: 'cash' }),
    wallet({ id: 'old', archivedAt: '2026-01-01T00:00:00Z' }),
  ])
  await db.goals.put(goal({ id: 'g', currency: 'SAR' }))
  await db.setAsides.put(HELD)
  takePlanRecalcRequests()
})

describe('moveSetAsideTo', () => {
  it('moves the whole row and keeps the planned link, reading once as moved', async () => {
    await moveSetAsideTo('held', 'savings')

    expect(await held()).toEqual([['savings', m(300), 'SAR']])
    const [arrived] = await live()
    expect(arrived).toMatchObject({ plannedId: 'p1', goalId: 'g' })
    expect(await story()).toEqual([
      ['Moved to Savings', 'Bank', 'SR 300'],
      ['Set aside', 'Bank', '+SR 300'],
    ])
    expect(await stateOf('held')).toEqual({ kind: 'moved' })
    expect(takePlanRecalcRequests()).toEqual([])
  })

  it('names only the wallet on the wire and stamps one id on both rows', async () => {
    await moveSetAsideTo('held', 'savings')

    const [entry] = await db.outbox.toArray()
    const payload = entry.payload as MoveWire
    expect(payload.items[0].to).toEqual({ wallet_id: 'savings' })
    expect(payload.transfer_id).toBeTruthy()
    expect((await db.setAsides.get('held'))?.movedByTransferId).toBe(
      payload.transfer_id,
    )
    expect((await live())[0].movedByTransferId).toBe(payload.transfer_id)
  })

  it('moves part: the rest stays where it was, with the link on both', async () => {
    await moveSetAsideTo('held', 'savings', m(100))

    expect(await held()).toEqual(
      expect.arrayContaining([
        ['bank', m(200), 'SAR'],
        ['savings', m(100), 'SAR'],
      ]),
    )
    expect((await live()).map((a) => a.plannedId)).toEqual(['p1', 'p1'])
    const lines = await story()
    expect(lines).toContainEqual(['Moved to Savings', 'Bank', 'SR 100'])
    expect(lines.filter(([label]) => label === 'Taken back')).toEqual([])
  })

  it('converts into the target wallet’s currency and reads as moved', async () => {
    await moveSetAsideTo('held', 'dollars')

    expect(await held()).toEqual([['dollars', m(80), 'USD']])
    expect((await db.outbox.toArray()).map((e) => e.op)).toEqual([
      'move',
      'update',
    ])
    expect(await story()).toEqual([
      ['Moved to Dollars', 'Bank', 'SR 300'],
      ['Set aside', 'Bank', '+SR 300'],
    ])
    expect(await stateOf('held')).toEqual({ kind: 'moved' })
  })

  it('still reads as moved after moving on through another currency', async () => {
    await moveSetAsideTo('held', 'dollars')
    const [arrived] = await live()
    await moveSetAsideTo(arrived.id, 'cash')

    expect(await story()).toEqual([
      ['Moved to Cash', 'Dollars', 'SR 300'],
      ['Moved to Dollars', 'Bank', 'SR 300'],
      ['Set aside', 'Bank', '+SR 300'],
    ])
    expect(await stateOf('held')).toEqual({ kind: 'moved' })
    expect(await stateOf(arrived.id)).toEqual({ kind: 'moved' })
  })

  it('tells part of an arrival moved on just once', async () => {
    await moveSetAsideTo('held', 'savings')
    const [arrived] = await live()
    await moveSetAsideTo(arrived.id, 'cash', m(100))

    expect(await story()).toEqual([
      ['Moved to Cash', 'Savings', 'SR 100'],
      ['Moved to Savings', 'Bank', 'SR 300'],
      ['Set aside', 'Bank', '+SR 300'],
    ])
  })

  it('reads a freed row after it was moved as taken back from where it went', async () => {
    await moveSetAsideTo('held', 'savings')
    const [arrived] = await live()
    await db.setAsides.update(arrived.id, { releasedAt: '2026-11-01' })

    expect(await story()).toContainEqual(['Taken back', 'Savings', 'SR 300'])
    expect(await stateOf(arrived.id)).toMatchObject({ kind: 'freed' })
    expect(await stateOf('held')).toEqual({ kind: 'moved' })
  })

  it('refuses what cannot be moved, writing nothing', async () => {
    expect(await code(moveSetAsideTo('nope', 'savings'))).toBe('not_found')
    expect(await code(moveSetAsideTo('held', 'nope'))).toBe('no_wallet')
    expect(await code(moveSetAsideTo('held', 'bank'))).toBe('no_wallet')
    expect(await code(moveSetAsideTo('held', 'old'))).toBe('no_wallet')
    expect(await code(moveSetAsideTo('held', 'savings', 0))).toBe('bad_amount')
    expect(await code(moveSetAsideTo('held', 'savings', m(301)))).toBe(
      'bad_amount',
    )
    // One halala is nothing in dollars.
    expect(await code(moveSetAsideTo('held', 'dollars', 1))).toBe('bad_amount')
    await db.setAsides.update('held', { releasedAt: '2026-10-01' })
    expect(await code(moveSetAsideTo('held', 'savings'))).toBe('not_found')
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('moveHeldTo', () => {
  beforeEach(async () => {
    await db.setAsides.bulkPut([
      setAside({
        id: 'older',
        goalId: 'g',
        walletId: 'bank',
        amount: m(100),
        date: '2026-08-01',
      }),
      setAside({
        id: 'elsewhere',
        goalId: 'g',
        walletId: 'cash',
        amount: m(50),
      }),
      setAside({
        id: 'other-owner',
        goalId: 'g2',
        walletId: 'bank',
        amount: m(70),
      }),
    ])
  })

  it('moves everything the owner holds there by default', async () => {
    await moveHeldTo(goalOwner('g'), 'bank', 'savings')

    const moved = (await live()).filter((a) => a.walletId === 'savings')
    expect(moved.map((a) => a.amount).sort()).toEqual([m(100), m(300)])
    expect((await db.setAsides.get('other-owner'))?.releasedAt).toBeNull()
    expect((await db.setAsides.get('elsewhere'))?.releasedAt).toBeNull()
    expect(await db.outbox.count()).toBe(1)
  })

  it('takes the oldest rows first, the last one in part', async () => {
    await moveHeldTo(goalOwner('g'), 'bank', 'savings', m(150))

    expect((await db.setAsides.get('older'))?.releasedAt).not.toBeNull()
    expect(await db.setAsides.get('held')).toMatchObject({ amount: m(50) })
    const moved = (await live()).filter((a) => a.walletId === 'savings')
    expect(moved.map((a) => a.amount).sort()).toEqual([m(100), m(50)])
    const bank = (await live()).filter(
      (a) => a.walletId === 'bank' && a.goalId === 'g',
    )
    expect(bank.map((a) => a.amount)).toEqual([m(250)])
  })

  it('reads the amount in the owner’s currency whatever the rows are in', async () => {
    await db.setAsides.update('older', { amount: m(100), currency: 'USD' })
    await moveHeldTo(goalOwner('g'), 'bank', 'cash', m(375))

    expect((await db.setAsides.get('older'))?.releasedAt).not.toBeNull()
    expect((await db.setAsides.get('held'))?.releasedAt).toBeNull()
  })

  it('moves a bill’s rows, keeping occurrence', async () => {
    await db.bills.put(bill({ id: 'b', currency: 'SAR' }))
    await db.setAsides.put(
      setAside({
        id: 'b1',
        goalId: null,
        billId: 'b',
        occurrence: '2026-11-01',
        walletId: 'bank',
      }),
    )
    await moveHeldTo(billOwner('b'), 'bank', 'savings')
    const [arrived] = (await live()).filter((a) => a.billId === 'b')
    expect(arrived).toMatchObject({
      walletId: 'savings',
      occurrence: '2026-11-01',
    })
  })

  it('does nothing when nothing is held, and refuses bad requests', async () => {
    await moveHeldTo(goalOwner('g'), 'savings', 'cash')
    expect(await db.outbox.count()).toBe(0)
    expect(await code(moveHeldTo(goalOwner('g'), 'bank', 'bank'))).toBe(
      'no_wallet',
    )
    expect(await code(moveHeldTo(goalOwner('g'), 'bank', 'nope'))).toBe(
      'no_wallet',
    )
    expect(await code(moveHeldTo(goalOwner('none'), 'bank', 'cash'))).toBe(
      'not_found',
    )
    expect(await code(moveHeldTo(goalOwner('g'), 'bank', 'cash', m(999)))).toBe(
      'bad_amount',
    )
    expect(await code(moveHeldTo(goalOwner('g'), 'bank', 'cash', 0))).toBe(
      'bad_amount',
    )
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('applyRebalance', () => {
  const move = (over: Partial<RebalanceMove>): RebalanceMove => ({
    setAsideId: 'held',
    ownerKind: 'goal',
    ownerName: 'Goal',
    occurrence: null,
    toWalletId: 'savings',
    amount: m(100),
    currency: 'SAR',
    ...over,
  })

  it('does nothing for no moves', async () => {
    await applyRebalance([])
    expect(await db.outbox.count()).toBe(0)
  })

  it('queues one batch per target wallet', async () => {
    await db.setAsides.put(
      setAside({ id: 'more', goalId: 'g', walletId: 'bank', amount: m(40) }),
    )
    await applyRebalance([
      move({ amount: m(100) }),
      move({ setAsideId: 'more', amount: m(40) }),
    ])

    const entries = await db.outbox.toArray()
    expect(entries.map((e) => e.op)).toEqual(['move'])
    expect((entries[0].payload as MoveWire).items).toHaveLength(2)
  })

  it('splits one row across wallets, each reading as its own move', async () => {
    await applyRebalance([
      move({ amount: m(200), toWalletId: 'savings' }),
      move({ amount: m(100), toWalletId: 'cash' }),
    ])

    expect(await held()).toEqual(
      expect.arrayContaining([
        ['savings', m(200), 'SAR'],
        ['cash', m(100), 'SAR'],
      ]),
    )
    expect((await live()).map((a) => a.plannedId)).toEqual(['p1', 'p1'])
    const entries = await db.outbox.toArray()
    expect(entries.map((e) => e.op)).toEqual(['move', 'move'])
    const [first, second] = entries.map((e) => e.payload as MoveWire)
    // The second moves the remainder the first wrote, whole.
    expect(second.items[0].id).toBe(first.items[0].remainder_id)
    expect(second.items[0].amount).toBeUndefined()
    expect(first.transfer_id).not.toBe(second.transfer_id)
    const lines = await story()
    expect(lines).toContainEqual(['Moved to Savings', 'Bank', 'SR 200'])
    expect(lines).toContainEqual(['Moved to Cash', 'Bank', 'SR 100'])
    expect(lines.filter(([label]) => label === 'Taken back')).toEqual([])
  })

  it('splits three ways, leaving the rest where it was', async () => {
    await applyRebalance([
      move({ amount: m(100), toWalletId: 'savings' }),
      move({ amount: m(50), toWalletId: 'cash' }),
    ])
    expect(await held()).toEqual(
      expect.arrayContaining([
        ['savings', m(100), 'SAR'],
        ['cash', m(50), 'SAR'],
        ['bank', m(150), 'SAR'],
      ]),
    )
  })

  it('refuses a plan gone stale, writing nothing', async () => {
    expect(
      await code(
        applyRebalance([
          move({ toWalletId: 'savings' }),
          move({ setAsideId: 'gone' }),
        ]),
      ),
    ).toBe('not_found')
    expect(
      await code(
        applyRebalance([
          move({ amount: m(200), toWalletId: 'savings' }),
          move({ amount: m(200), toWalletId: 'cash' }),
        ]),
      ),
    ).toBe('bad_amount')
    expect(await code(applyRebalance([move({ currency: 'USD' })]))).toBe(
      'bad_amount',
    )
    expect(await code(applyRebalance([move({ toWalletId: 'bank' })]))).toBe(
      'no_wallet',
    )
    expect(await db.outbox.count()).toBe(0)
    expect((await db.setAsides.get('held'))?.releasedAt).toBeNull()
  })
})
