import { describe, expect, it } from 'vitest'
import type { LocalGoal, LocalPlanned } from '#/db/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { goal, m, planned } from '#/features/planned/testing/fixtures'
import type { DesiredPlanned } from './generate'
import { orphanedPlanned, reconcilePlanned } from './reconcile'
import type { ReconcileContext } from './reconcile'

const TODAY = '2026-09-24'

const want = (row: LocalPlanned): DesiredPlanned => {
  const { createdAt, updatedAt, version, dirty, deleted, ...rest } = row
  void [createdAt, updatedAt, version, dirty, deleted]
  return rest
}

const umrah = goal({
  id: 'umrah',
  target: m(13000),
  dueDate: '2027-03-01',
  plannedAt: '2026-06-12',
})
const fund = goal({ id: 'fund', amount: m(900), plannedAt: '2026-06-12' })
const car = goal({ id: 'car', amount: m(500), plannedAt: '2026-06-12' })

const ctx = (over: Partial<ReconcileContext> = {}): ReconcileContext => {
  const goals: LocalGoal[] = [umrah, fund, car]
  return {
    today: TODAY,
    mode: 'fill',
    isSettled: () => false,
    goals: new Map(goals.map((g) => [g.id, g])),
    activeGoalIds: new Set(goals.map((g) => g.id)),
    incomeIds: new Set(['salary']),
    billIds: new Set(['rent']),
    ...over,
  }
}

const setAside = (goalId: string, occurrence: string, amount = m(1500)) =>
  planned({ id: `${goalId}:${occurrence}`, goalId, occurrence, amount })

const payday = (occurrence: string, amount = m(20000)) =>
  planned({
    id: `salary:${occurrence}`,
    origin: 'income',
    role: 'income',
    goalId: null,
    incomeStreamId: 'salary',
    name: 'Salary',
    occurrence,
    amount,
  })

describe('reconcilePlanned — fill', () => {
  it('creates what is missing and never rewrites an existing goal row', () => {
    const existing = [setAside('umrah', '2026-10-01')]
    const desired = [
      want(setAside('umrah', '2026-10-01', m(1800))),
      want(payday('2026-09-27')),
    ]
    const plan = reconcilePlanned(desired, existing, ctx())
    expect(plan.create.map((d) => d.id)).toEqual(['salary:2026-09-27'])
    expect(plan.update).toEqual([])
    expect(plan.remove).toEqual([])
  })

  it('leaves a one-time goal’s stored plan exactly as saved, even when the live plan moved', () => {
    const existing = [
      setAside('umrah', '2026-10-01'),
      setAside('umrah', '2026-11-01'),
    ]
    // The live plan now starts later and runs longer.
    const desired = [
      want(setAside('umrah', '2026-12-01', m(2000))),
      want(setAside('umrah', '2027-01-01', m(2000))),
    ]
    const plan = reconcilePlanned(desired, existing, ctx())
    expect(plan).toEqual({ create: [], update: [], remove: [] })
  })

  it('grows a rolling plan only past its last set-aside', () => {
    const existing = [
      setAside('fund', '2026-10-01'),
      setAside('fund', '2026-11-01'),
    ]
    const desired = [
      want(setAside('fund', '2026-11-01', m(900))),
      want(setAside('fund', '2026-12-01', m(900))),
    ]
    const plan = reconcilePlanned(desired, existing, ctx())
    expect(plan.create.map((d) => d.id)).toEqual(['fund:2026-12-01'])
    expect(plan.remove).toEqual([])
  })

  it('drops the future rows an origin stopped producing (a payday moved)', () => {
    const existing = [payday('2026-09-27'), payday('2026-10-27')]
    const desired = [want(payday('2026-10-15'))]
    const plan = reconcilePlanned(desired, existing, ctx())
    expect(plan.remove).toEqual(['salary:2026-09-27', 'salary:2026-10-27'])
    expect(plan.create.map((d) => d.id)).toEqual(['salary:2026-10-15'])
  })

  it('follows a stream’s edits on its future rows (it has no stored plan)', () => {
    const existing = [payday('2026-10-27')]
    const plan = reconcilePlanned(
      [want(payday('2026-10-27', m(21000)))],
      existing,
      ctx(),
    )
    expect(plan.update).toEqual([
      { id: 'salary:2026-10-27', patch: { amount: m(21000) } },
    ])
  })

  it('follows a bill’s new category on its future rows', () => {
    const gym = (categoryId: string) =>
      planned({
        id: 'gym:2026-10-05',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'rent',
        name: 'Gym',
        occurrence: '2026-10-05',
        categoryId,
      })
    const plan = reconcilePlanned(
      [want(gym(catId('fitness', 'health')))],
      [gym(catId('health'))],
      ctx(),
    )
    expect(plan.update).toEqual([
      {
        id: 'gym:2026-10-05',
        patch: { categoryId: catId('fitness', 'health') },
      },
    ])
  })

  it('drops a completed goal’s future set-asides', () => {
    const existing = [setAside('umrah', '2026-10-01')]
    const plan = reconcilePlanned(
      [],
      existing,
      ctx({ activeGoalIds: new Set(['fund', 'car']) }),
    )
    expect(plan.remove).toEqual(['umrah:2026-10-01'])
  })

  it('removes a deleted origin’s future unsettled rows and keeps its history', () => {
    const history = [
      setAside('gone', '2026-09-01'),
      setAside('gone', '2026-10-01', m(1500)),
      { ...setAside('gone', '2026-11-01'), status: 'done' as const },
      { ...setAside('gone', '2026-12-01'), pinned: true },
    ]
    const settled = setAside('gone', '2027-01-01')
    const future = setAside('gone', '2027-02-01')
    const plan = reconcilePlanned(
      [],
      [...history, settled, future],
      ctx({ isSettled: (p) => p.id === settled.id }),
    )
    // Past, done and settled rows stay; a pinned future one goes with its goal.
    expect(plan.remove.sort()).toEqual(
      ['gone:2026-10-01', 'gone:2026-12-01', 'gone:2027-02-01'].sort(),
    )
  })

  it('removes a deleted stream’s and bill’s future rows', () => {
    const plan = reconcilePlanned(
      [],
      [
        payday('2026-10-27'),
        planned({
          id: 'gym:2026-10-05',
          origin: 'bill',
          role: 'payment',
          goalId: null,
          billId: 'gym',
          occurrence: '2026-10-05',
        }),
      ],
      ctx({ incomeIds: new Set(), billIds: new Set() }),
    )
    expect(plan.remove.sort()).toEqual(['gym:2026-10-05', 'salary:2026-10-27'])
  })

  it('never touches a hand-made row', () => {
    const manual = planned({
      origin: 'manual',
      goalId: 'umrah',
      occurrence: '2026-10-15',
    })
    expect(reconcilePlanned([], [manual], ctx())).toEqual({
      create: [],
      update: [],
      remove: [],
    })
  })

  it('leaves goals it was told to skip for a rewrite', () => {
    const plan = reconcilePlanned(
      [want(setAside('fund', '2027-01-01'))],
      [setAside('fund', '2026-10-01')],
      ctx({ skipGoalIds: new Set(['fund']) }),
    )
    expect(plan).toEqual({ create: [], update: [], remove: [] })
  })

  it('moves future open paydays when the stream’s dates change, keeping settled and pinned ones', () => {
    const settled = payday('2026-10-30')
    const pinned = { ...payday('2026-11-30'), pinned: true }
    const existing = [
      payday('2026-09-30'),
      settled,
      pinned,
      payday('2026-12-30'),
    ]
    // The anchor moved: the stream now pays in Oct / Jan instead of Sep / Dec.
    const desired = [want(payday('2026-10-15')), want(payday('2027-01-15'))]
    const plan = reconcilePlanned(
      desired,
      existing,
      ctx({ isSettled: (p) => p.id === settled.id }),
    )
    expect(plan.create.map((d) => d.id).sort()).toEqual([
      'salary:2026-10-15',
      'salary:2027-01-15',
    ])
    expect(plan.remove.sort()).toEqual([
      'salary:2026-09-30',
      'salary:2026-12-30',
    ])
    expect(plan.update).toEqual([])
  })
})

describe('reconcilePlanned — recalc', () => {
  const recalc = (over: Partial<ReconcileContext> = {}) =>
    ctx({ mode: 'recalc', goalId: 'umrah', ...over })

  it('rewrites only the goal’s future, open, unpinned, unsettled rows', () => {
    const existing = [
      setAside('umrah', '2026-09-01'), // due — the backlog
      setAside('umrah', '2026-10-01'),
      { ...setAside('umrah', '2026-11-01'), pinned: true },
      { ...setAside('umrah', '2026-12-01'), status: 'skipped' as const },
      setAside('umrah', '2027-01-01'), // partly settled
      setAside('umrah', '2027-02-01'),
      setAside('fund', '2026-10-01'), // another goal
    ]
    const desired = [
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ].map((d) => want(setAside('umrah', d, m(1800))))
    const plan = reconcilePlanned(
      desired,
      existing,
      recalc({ isSettled: (p) => p.id === 'umrah:2027-01-01' }),
    )
    expect(plan.update.map((u) => u.id)).toEqual([
      'umrah:2026-10-01',
      'umrah:2027-02-01',
    ])
    expect(plan.update[0].patch).toEqual({ amount: m(1800) })
    expect(plan.create).toEqual([])
    expect(plan.remove).toEqual([])
  })

  it('creates the months the new plan adds and removes the ones it drops', () => {
    const existing = [
      setAside('umrah', '2026-10-01'),
      setAside('umrah', '2026-11-01'),
    ]
    const desired = [
      want(setAside('umrah', '2026-11-01', m(1800))),
      want(setAside('umrah', '2026-12-01', m(1800))),
    ]
    const plan = reconcilePlanned(desired, existing, recalc())
    expect(plan.remove).toEqual(['umrah:2026-10-01'])
    expect(plan.update.map((u) => u.id)).toEqual(['umrah:2026-11-01'])
    expect(plan.create.map((d) => d.id)).toEqual(['umrah:2026-12-01'])
  })

  it('leaves DONE, SKIPPED, pinned, due and partly settled rows alone in both modes', () => {
    const untouchable = [
      { ...setAside('umrah', '2026-10-01'), status: 'done' as const },
      { ...setAside('umrah', '2026-11-01'), status: 'skipped' as const },
      { ...setAside('umrah', '2026-12-01'), pinned: true },
      setAside('umrah', '2026-09-01'),
      setAside('umrah', '2027-01-01'),
    ]
    const isSettled = (p: LocalPlanned) => p.id === 'umrah:2027-01-01'
    for (const mode of ['fill', 'recalc'] as const) {
      const plan = reconcilePlanned(
        [],
        untouchable,
        ctx({ mode, goalId: 'umrah', isSettled }),
      )
      expect(plan).toEqual({ create: [], update: [], remove: [] })
    }
  })
})

describe('orphanedPlanned', () => {
  const origins = {
    goalIds: new Set(['umrah']),
    incomeIds: new Set(['salary']),
    billIds: new Set(['rent']),
  }
  const row = (id: string, over: Partial<LocalPlanned>) =>
    planned({ id, occurrence: '2026-09-01', ...over })

  it('skips unsettled open rows whose origin is gone and closes the rest of partly settled ones', () => {
    const rows = [
      row('goal-gone', { goalId: 'gone' }),
      row('goal-null', { goalId: null }),
      row('goal-partial', { goalId: 'gone' }),
      row('income-gone', {
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'old-stream',
      }),
      row('bill-null', {
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: null,
      }),
      row('bill-gone', {
        origin: 'bill',
        role: 'set_aside',
        goalId: null,
        billId: 'old-bill',
      }),
    ]
    const plan = orphanedPlanned(rows, origins, (p) => p.id === 'goal-partial')
    expect(plan.skip.sort()).toEqual(
      [
        'goal-gone',
        'goal-null',
        'income-gone',
        'bill-null',
        'bill-gone',
      ].sort(),
    )
    expect(plan.closeRest).toEqual(['goal-partial'])
  })

  it('leaves live origins, closed rows and hand-made payments alone', () => {
    const rows = [
      row('live-goal', { goalId: 'umrah' }),
      row('live-income', {
        origin: 'income',
        role: 'income',
        goalId: null,
        incomeStreamId: 'salary',
      }),
      row('done-gone', { goalId: 'gone', status: 'done' }),
      row('skipped-gone', { goalId: 'gone', status: 'skipped' }),
      row('manual-payment', {
        origin: 'manual',
        role: 'payment',
        goalId: 'gone',
      }),
      row('manual-live', { origin: 'manual', goalId: 'umrah' }),
    ]
    expect(orphanedPlanned(rows, origins, () => false)).toEqual({
      skip: [],
      closeRest: [],
    })
  })

  it('skips a hand-made set-aside whose goal or bill is gone — it could never be confirmed', () => {
    const plan = orphanedPlanned(
      [
        row('manual-set-aside', { origin: 'manual', goalId: 'gone' }),
        row('manual-bill-set-aside', {
          origin: 'manual',
          goalId: null,
          billId: 'old-bill',
        }),
        row('manual-live-bill', {
          origin: 'manual',
          goalId: null,
          billId: 'rent',
        }),
      ],
      origins,
      () => false,
    )
    expect(plan.skip).toEqual(['manual-set-aside', 'manual-bill-set-aside'])
  })
})
