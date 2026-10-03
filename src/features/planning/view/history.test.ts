import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { autoSettlementId } from '#/features/planned/data/autoConfirm'
import { m, setAside, tx } from '#/features/planned/testing/fixtures'
import {
  moveSetAsides,
  releaseSetAsides,
} from '#/features/setAsides/data/batches'
import { historyOf } from './history'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const base = {
  currency: 'SAR',
  setAsides: [],
  planned: [],
  walletName: () => 'Main bank',
  categoryName: () => 'Visa fees',
  rates: {},
}

describe('historyOf', () => {
  it('marks a payment auto-pay made', () => {
    const lines = historyOf({
      ...base,
      kind: 'bill',
      id: 'b',
      txns: [
        tx({ id: autoSettlementId('p1'), billId: 'b', plannedId: 'p1' }),
        tx({ id: 'manual', billId: 'b', plannedId: 'p2', date: '2026-08-01' }),
      ],
    })
    expect(lines.map((l) => [l.label, l.sub])).toEqual([
      ['Paid · auto-pay', 'Main bank'],
      ['Paid', 'Main bank'],
    ])
  })

  it('names what a goal’s money was used for and where from', () => {
    const [line] = historyOf({
      ...base,
      kind: 'goal',
      id: 'g',
      txns: [tx({ goalId: 'g', amount: m(400) })],
    })
    expect(line).toMatchObject({
      label: 'Used',
      sub: 'Visa fees · Main bank',
      amount: '−SR 400',
    })
  })

  it('shows a freed set-aside as taken back', () => {
    const lines = historyOf({
      ...base,
      kind: 'goal',
      id: 'g',
      txns: [],
      setAsides: [
        setAside({ goalId: 'g', releasedAt: '2026-09-10T00:00:00Z' }),
      ],
    })
    expect(lines.map((l) => l.label)).toEqual(['Taken back', 'Set aside'])
  })
})

describe('money a transfer moved', () => {
  const WALLETS: Record<string, string> = {
    savings: 'Savings',
    main: 'Main bank',
    card: 'Card',
  }
  const HELD = setAside({
    id: 'held',
    goalId: 'g',
    walletId: 'savings',
    amount: m(300),
    date: '2026-09-01',
    createdAt: '2026-09-01T08:00:00.000Z',
  })

  const story = async () =>
    historyOf({
      ...base,
      kind: 'goal',
      id: 'g',
      txns: [],
      setAsides: await db.setAsides.toArray(),
      walletName: (id) => (id ? (WALLETS[id] ?? id) : 'No wallet'),
    }).map((l) => [l.label, l.sub, l.amount])

  const live = async () =>
    (await db.setAsides.toArray()).filter((a) => a.releasedAt === null)

  const moveWithTransfer = (id: string, to: string, transferId: string) =>
    moveSetAsides([{ id, to: { walletId: to } }], {
      date: '2026-10-01',
      transferId,
    })

  beforeEach(async () => {
    await Promise.all([db.setAsides, db.bills, db.outbox].map((t) => t.clear()))
    await db.setAsides.put(HELD)
  })

  it('tells it once: set aside where it was, then moved to where it went', async () => {
    await moveWithTransfer('held', 'main', 'tr')

    expect(await story()).toEqual([
      ['Moved to Main bank', 'Savings', 'SR 300'],
      ['Set aside', 'Savings', '+SR 300'],
    ])
  })

  it('adds nothing when the moved money is used', async () => {
    await moveWithTransfer('held', 'main', 'tr')
    const [arrived] = await live()
    await releaseSetAsides([{ id: arrived.id }], {
      releasedAt: '2026-10-05',
      releasedById: 'pay',
    })

    expect(await story()).toEqual([
      ['Moved to Main bank', 'Savings', 'SR 300'],
      ['Set aside', 'Savings', '+SR 300'],
    ])
  })

  it('reads moved money freed later as taken back from where it went', async () => {
    await moveWithTransfer('held', 'main', 'tr')
    const [arrived] = await live()
    await releaseSetAsides([{ id: arrived.id }], { releasedAt: '2026-10-05' })

    expect(await story()).toEqual([
      ['Taken back', 'Main bank', 'SR 300'],
      ['Moved to Main bank', 'Savings', 'SR 300'],
      ['Set aside', 'Savings', '+SR 300'],
    ])
  })

  it('follows money moved on by a second transfer', async () => {
    await moveWithTransfer('held', 'main', 'tr1')
    const [arrived] = await live()
    await moveSetAsides([{ id: arrived.id, to: { walletId: 'card' } }], {
      date: '2026-10-03',
      transferId: 'tr2',
    })

    expect(await story()).toEqual([
      ['Moved to Card', 'Main bank', 'SR 300'],
      ['Moved to Main bank', 'Savings', 'SR 300'],
      ['Set aside', 'Savings', '+SR 300'],
    ])
  })

  it('splits a part move between the money that went and the money that stayed', async () => {
    await moveSetAsides(
      [{ id: 'held', amount: m(100), to: { walletId: 'main' } }],
      {
        date: '2026-10-01',
        transferId: 'tr',
      },
    )

    const [moved, ...made] = await story()
    expect(moved).toEqual(['Moved to Main bank', 'Savings', 'SR 100'])
    expect(made.sort()).toEqual([
      ['Set aside', 'Savings', '+SR 100'],
      ['Set aside', 'Savings', '+SR 200'],
    ])
  })

  it('reads an undone transfer as moved, taken back and set aside again', async () => {
    await moveWithTransfer('held', 'main', 'tr')
    const [arrived] = await live()
    await moveSetAsides([{ id: arrived.id, to: { walletId: 'savings' } }], {
      date: '2026-10-02',
    })

    expect(await story()).toEqual([
      ['Set aside', 'Savings', '+SR 300'],
      ['Taken back', 'Main bank', 'SR 300'],
      ['Moved to Main bank', 'Savings', 'SR 300'],
      ['Set aside', 'Savings', '+SR 300'],
    ])
  })

  it('still reads money that arrived from a row it no longer has as moved in', async () => {
    await db.setAsides.put({ ...HELD, movedByTransferId: 'tr' })

    expect(await story()).toEqual([['Moved in', 'Savings', '+SR 300']])
  })
})
