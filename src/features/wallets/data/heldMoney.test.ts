import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { m, setAside, wallet } from '#/features/planned/testing/fixtures'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import {
  freeSetAsidesUnder,
  moveSetAsidesOutOf,
  walletIdsUnder,
} from './heldMoney'
import { deleteNode } from './mutations'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const GROUP = wallet({
  id: 'bank',
  kind: 'group',
  name: 'Bank',
  amount: null,
  currency: null,
})

beforeEach(async () => {
  await Promise.all(
    [db.balanceNodes, db.setAsides, db.outbox].map((t) => t.clear()),
  )
  await db.balanceNodes.bulkPut([
    GROUP,
    wallet({ id: 'main', parentId: 'bank' }),
    wallet({ id: 'cash' }),
  ])
  await db.setAsides.bulkPut([
    setAside({ id: 'a', walletId: 'main', amount: m(300), version: 'v1' }),
    setAside({ id: 'b', walletId: 'cash', amount: m(100), version: 'v1' }),
  ])
})

const live = async () =>
  (await db.setAsides.toArray())
    .filter(isLiveSetAside)
    .map((a) => [a.walletId, a.amount])

describe('set-asides in a wallet that leaves', () => {
  it('finds the wallets a group stands for', async () => {
    expect([
      ...walletIdsUnder(await db.balanceNodes.toArray(), 'bank'),
    ]).toEqual(['main'])
  })

  it('moves them to another wallet when archiving', async () => {
    await moveSetAsidesOutOf('bank', 'cash')
    expect(await live()).toEqual(
      expect.arrayContaining([
        ['cash', m(100)],
        ['cash', m(300)],
      ]),
    )
    expect((await db.outbox.toArray()).map((e) => e.op)).toEqual(['move'])
  })

  it('frees them when archiving, or when the wallet is deleted', async () => {
    await freeSetAsidesUnder('bank')
    expect(await live()).toEqual([['cash', m(100)]])

    await deleteNode('cash')
    expect(await live()).toEqual([])
    expect((await db.outbox.toArray()).map((e) => [e.entity, e.op])).toEqual([
      ['setAside', 'release'],
      ['setAside', 'release'],
      ['node', 'delete'],
    ])
  })
})
