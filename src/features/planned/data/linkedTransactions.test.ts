import 'fake-indexeddb/auto'
import { liveQuery } from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import {
  allocation,
  goal,
  income,
  m,
  planned,
  recurring,
  tx,
  wallet,
} from '#/features/planned/testing/fixtures'
import { isoOf } from './dates'
import { linkedTransactions } from './linkedTransactions'
import { loadPlannerInputs } from './runner'
import { legacyMarkerOf } from './settle'
import { derivePlannerState, liveInputs } from './state'
import type { PlannerInputs } from './state'
import { buildGoalPlanView } from './views'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const JUN_12 = new Date(2026, 5, 12)
const USER = 'u1'
const MAIN = wallet({ id: 'w1', name: 'Main Checking' })

const ids = (rows: ReadonlyArray<LocalTransaction>) => rows.map((t) => t.id)

beforeEach(async () => {
  await Promise.all(
    [
      db.transactions,
      db.plannedTransactions,
      db.goalAllocations,
      db.goals,
      db.incomeStreams,
      db.recurrings,
      db.balanceSettings,
      db.exchangeRates,
    ].map((t) => t.clear()),
  )
})

describe('linkedTransactions', () => {
  it('reads exactly the goal-linked, planned-linked and legacy auto-post rows', async () => {
    await db.transactions.bulkPut([
      tx({ id: 't9-goal', goalId: 'g1' }),
      tx({ id: 't1-planned', plannedId: 'p1' }),
      tx({ id: 't5-both', goalId: 'g1', plannedId: 'p2' }),
      tx({ id: 't3-legacy', source: legacyMarkerOf('r1', '2026-09-01') }),
      tx({ id: 't2-import', source: 'import:batch-1' }),
      tx({ id: 't4-neither' }),
      tx({ id: 't0-deleted-linked', plannedId: 'p3', deleted: 1 }),
      tx({ id: 't6-deleted-unlinked', deleted: 1 }),
      tx({ id: 't7-transfer', type: 'transfer_out', transferId: 'x1' }),
    ])

    expect(ids(await linkedTransactions())).toEqual([
      't0-deleted-linked',
      't1-planned',
      't3-legacy',
      't5-both',
      't9-goal',
    ])
  })

  it('gives the planner exactly what a full-table read gave it', async () => {
    const umrah = goal({
      id: 'umrah',
      kind: 'onetime',
      target: m(13000),
      saved: m(1000),
      dueDate: '2027-03-01',
    })
    const rent = goal({
      id: 'rent',
      kind: 'recurring',
      amount: m(3000),
      frequency: 'monthly',
      nextDue: '2026-06-25',
    })
    await db.goals.bulkPut([umrah, rent])
    await db.incomeStreams.put(
      income({ id: 'salary', amount: m(20000), day: 27, walletId: 'w1' }),
    )
    await db.recurrings.put(
      recurring({ id: 'gym', nextDue: '2026-06-05', autopost: true }),
    )
    await db.plannedTransactions.bulkPut([
      planned({ id: 'p-umrah', goalId: 'umrah', occurrence: '2026-06-01' }),
      planned({
        id: 'p-rent',
        goalId: 'rent',
        role: 'payment',
        amount: m(3000),
        occurrence: '2026-05-25',
      }),
      planned({
        id: 'p-salary',
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
        amount: m(20000),
        occurrence: '2026-05-27',
      }),
    ])
    await db.goalAllocations.put(
      allocation({ goalId: 'umrah', amount: m(900), date: '2026-06-01' }),
    )
    await db.transactions.bulkPut([
      tx({ goalId: 'umrah', amount: m(400), date: '2026-06-02' }),
      tx({ goalId: 'rent', plannedId: 'p-rent', amount: m(3000) }),
      tx({ type: 'income', plannedId: 'p-salary', amount: m(20000) }),
      tx({ source: legacyMarkerOf('gym', '2026-06-05'), amount: m(200) }),
      tx({ goalId: 'umrah', amount: m(50), deleted: 1 }),
      tx({ amount: m(35), date: '2026-06-03' }),
      tx({ type: 'income', amount: m(500), date: '2026-06-04' }),
      tx({ type: 'transfer_out', transferId: 'x1', amount: m(70) }),
      tx({ type: 'adjustment_in', amount: m(10) }),
    ])

    const narrowed = await loadPlannerInputs()
    const full: PlannerInputs = liveInputs({
      ...narrowed,
      txns: await db.transactions.toArray(),
    })
    expect(narrowed.txns).toHaveLength(4)
    expect(full.txns).toHaveLength(8)

    const before = derivePlannerState(full, USER, JUN_12)
    const after = derivePlannerState(narrowed, USER, JUN_12)
    expect(after).toEqual(before)
    // The dataset exercises every kind of link the planner reads.
    expect(after.index.has('p-rent')).toBe(true)
    expect(after.index.has('p-salary')).toBe(true)
    expect(
      [...after.index.keys()].some((k) => k.endsWith('gym:2026-06-05')),
    ).toBe(true)
    expect(after.progress.umrah?.progress).toBeGreaterThan(0)

    for (const g of [umrah, rent]) {
      const view = (inputs: PlannerInputs, state: typeof before) =>
        buildGoalPlanView({
          goal: g,
          planned: inputs.planned,
          desired: state.desired,
          txns: inputs.txns,
          allocations: inputs.allocations,
          progress: state.progress[g.id],
          nodes: [MAIN],
          index: state.index,
          rates: inputs.rates,
          today: isoOf(JUN_12),
        })
      expect(view(narrowed, after)).toEqual(view(full, before))
    }
  })

  describe('as a live query', () => {
    let seen: string[][] = []
    let stop: () => void = () => undefined

    beforeEach(() => {
      seen = []
      const sub = liveQuery(linkedTransactions).subscribe({
        next: (rows) => seen.push(rows.map((t) => `${t.id}:${t.amount}`)),
      })
      stop = () => sub.unsubscribe()
    })
    afterEach(() => stop())

    const latest = () => seen.at(-1)

    it('drops a row once it is unlinked and picks one up once it is linked', async () => {
      await db.transactions.bulkPut([
        tx({ id: 'a', goalId: 'g1', amount: 1 }),
        tx({ id: 'b', plannedId: 'p1', amount: 2 }),
        tx({ id: 'c', amount: 3 }),
      ])
      await vi.waitFor(() => expect(latest()).toEqual(['a:1', 'b:2']))

      await db.transactions.update('a', { goalId: null })
      await vi.waitFor(() => expect(latest()).toEqual(['b:2']))

      await db.transactions.update('b', { plannedId: null })
      await vi.waitFor(() => expect(latest()).toEqual([]))

      await db.transactions.update('c', { goalId: 'g2' })
      await vi.waitFor(() => expect(latest()).toEqual(['c:3']))
    })

    it('re-reads when a linked row changes a field it is not indexed on', async () => {
      await db.transactions.put(tx({ id: 'a', goalId: 'g1', amount: 1 }))
      await vi.waitFor(() => expect(latest()).toEqual(['a:1']))

      await db.transactions.update('a', { amount: 7 })
      await vi.waitFor(() => expect(latest()).toEqual(['a:7']))
    })
  })
})
