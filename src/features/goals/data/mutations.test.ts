import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import type {
  CreateGoalWire,
  CreateIncomeWire,
  UpdateGoalWire,
} from '#/features/goals/api/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { takePlanRecalcRequests } from '#/features/planned/data/recalcRequests'
import { goal, m, setAside, tx } from '#/features/planned/testing/fixtures'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { createGoal, createIncome, deleteGoal, deleteIncome, updateGoal } =
  await import('./mutations')

const queued = () => db.outbox.toArray()

beforeEach(async () => {
  takePlanRecalcRequests()
  await Promise.all(
    [
      db.goals,
      db.incomeStreams,
      db.setAsides,
      db.transactions,
      db.balanceSettings,
      db.outbox,
    ].map((t) => t.clear()),
  )
})

describe('goals', () => {
  it('creates a goal with no kind: its shape is just the fields it has', async () => {
    const id = await createGoal({
      name: 'Emergency fund',
      currency: 'SAR',
      color: '#EC4899',
      target: m(20000),
      amount: m(500),
      dueDate: null,
      mustHave: true,
    })

    expect(await db.goals.get(id)).toMatchObject({
      target: m(20000),
      amount: m(500),
      dueDate: null,
      mustHave: true,
      closedAt: null,
      pausedAt: null,
    })
    const [entry] = await queued()
    expect(entry.payload as CreateGoalWire).toMatchObject({
      id,
      target: m(20000),
      amount: m(500),
      due_date: null,
      must_have: true,
      save_wallet_id: null,
      use_category_id: null,
    })
    expect('kind' in (entry.payload as object)).toBe(false)
  })

  it('asks for a plan rewrite only when a planning field changes', async () => {
    await db.goals.put(goal({ id: 'g1', version: 'v1', amount: m(300) }))

    await updateGoal('g1', { name: 'Rainy day', color: '#000000' })
    expect(takePlanRecalcRequests()).toEqual([])

    await updateGoal('g1', { amount: m(400) })
    expect(takePlanRecalcRequests()).toEqual([
      { owner: { kind: 'goal', id: 'g1' }, quiet: false },
    ])
    const [entry] = await queued()
    expect(entry.payload as UpdateGoalWire).toMatchObject({
      version: 'v1',
      name: 'Rainy day',
      amount: m(400),
    })
  })

  it('takes a deleted goal’s set-asides along and unlinks spending from it', async () => {
    await db.goals.put(goal({ id: 'g1', version: 'v1' }))
    await db.setAsides.put(setAside({ id: 'a1', goalId: 'g1' }))
    await db.transactions.put(tx({ id: 't1', goalId: 'g1' }))

    await deleteGoal('g1')

    expect(await db.setAsides.count()).toBe(0)
    expect((await db.transactions.get('t1'))?.goalId).toBeNull()
    expect((await queued()).map((e) => [e.entity, e.op])).toEqual([
      ['goal', 'delete'],
    ])
  })
})

describe('income streams', () => {
  it('sends the category and a custom interval only with a custom frequency', async () => {
    const monthly = await createIncome({
      label: 'Salary',
      amount: m(12000),
      currency: 'SAR',
      frequency: 'monthly',
      customInterval: 14,
      customUnit: 'day',
      day: 25,
      color: '#1F9D6B',
      categoryId: catId('salary'),
    })
    const biweekly = await createIncome({
      label: 'Side work',
      amount: m(900),
      currency: 'SAR',
      frequency: 'custom',
      customInterval: 14,
      customUnit: 'day',
      day: 3,
      color: '#1F9D6B',
      categoryId: catId('salary'),
      autolog: true,
    })

    const payloads = new Map(
      (await queued()).map((e) => [e.id, e.payload as CreateIncomeWire]),
    )
    expect(payloads.get(monthly)).toMatchObject({
      frequency: 'MONTHLY',
      custom_interval: null,
      custom_unit: null,
      category_id: catId('salary'),
      autolog: false,
    })
    expect(payloads.get(biweekly)).toMatchObject({
      frequency: 'CUSTOM',
      custom_interval: 14,
      custom_unit: 'DAY',
      autolog: true,
    })
  })

  it('stops a deleted stream being the main paycheck', async () => {
    const id = await createIncome({
      label: 'Salary',
      amount: m(12000),
      currency: 'SAR',
      frequency: 'monthly',
      day: 25,
      color: '#1F9D6B',
      categoryId: catId('salary'),
    })
    await db.balanceSettings.put({
      id: SETTINGS_KEY,
      baseCurrency: 'SAR',
      mainIncomeStreamId: id,
      createdAt: '',
      updatedAt: '',
      version: 'v1',
      dirty: 0,
    })

    await deleteIncome(id)

    expect(await db.incomeStreams.get(id)).toBeUndefined()
    expect(
      (await db.balanceSettings.get(SETTINGS_KEY))?.mainIncomeStreamId,
    ).toBeNull()
  })
})
