import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { m, setAside, wallet } from '#/features/planned/testing/fixtures'
import { moveSetAsideTo } from '#/features/planning/actions/moveSetAside'
import { takeBackSetAside } from '#/features/planning/actions/setAsideEdit'
import { goalSavingRows } from './goalSaving'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const counted = async () =>
  goalSavingRows(await db.setAsides.toArray())
    .map((a) => [a.date, a.amount / 100])
    .sort()

describe('goalSavingRows', () => {
  it('counts a held goal set-aside and one a payment used', () => {
    const rows = goalSavingRows([
      setAside({ id: 'a', goalId: 'g', amount: m(100) }),
      setAside({
        id: 'b',
        goalId: 'g',
        amount: m(50),
        releasedAt: '2026-10-01',
        releasedById: 'tx1',
      }),
    ])
    expect(rows.map((a) => a.id).sort()).toEqual(['a', 'b'])
  })

  it('leaves out money freed, bills and deleted rows', () => {
    expect(
      goalSavingRows([
        setAside({ goalId: 'g', releasedAt: '2026-10-01' }),
        setAside({ goalId: null, billId: 'b1' }),
        setAside({ goalId: 'g', deleted: 1 }),
      ]),
    ).toEqual([])
  })
})

describe('goalSavingRows after a move between wallets', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.balanceNodes.bulkPut([
      wallet({ id: 'main', name: 'Main', amount: m(5000) }),
      wallet({ id: 'savings', name: 'Savings', amount: m(5000) }),
      wallet({ id: 'cash', name: 'Cash', amount: m(5000) }),
    ])
    await db.setAsides.put(
      setAside({
        id: 'first',
        goalId: 'g',
        walletId: 'main',
        amount: m(300),
        date: '2026-09-05',
        createdAt: '2026-09-05T00:00:00Z',
      }),
    )
  })

  const arrivalIn = async (walletId: string) => {
    const rows = await db.setAsides.toArray()
    const row = rows.find((a) => a.walletId === walletId && !a.releasedAt)
    if (!row) throw new Error(`nothing live in ${walletId}`)
    return row.id
  }

  it('counts it once, on the day it was first set aside', async () => {
    await moveSetAsideTo('first', 'savings')
    expect(await counted()).toEqual([['2026-09-05', 300]])
  })

  it('counts it once through two moves', async () => {
    await moveSetAsideTo('first', 'savings')
    await moveSetAsideTo(await arrivalIn('savings'), 'cash')
    expect(await counted()).toEqual([['2026-09-05', 300]])
  })

  it('counts part of it moved, still once', async () => {
    await moveSetAsideTo('first', 'savings', m(100))
    expect(await counted()).toEqual([
      ['2026-09-05', 100],
      ['2026-09-05', 200],
    ])
  })

  it('stops counting it once it is freed after the move', async () => {
    await moveSetAsideTo('first', 'savings')
    await takeBackSetAside(await arrivalIn('savings'))
    expect(await counted()).toEqual([])
  })

  it('keeps counting a payment made from where it was moved', async () => {
    await moveSetAsideTo('first', 'savings')
    await db.setAsides.update(await arrivalIn('savings'), {
      releasedAt: '2026-10-20',
      releasedById: 'tx9',
    })
    expect(await counted()).toEqual([['2026-09-05', 300]])
  })
})
