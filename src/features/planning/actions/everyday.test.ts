import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { BudgetDraft } from '#/features/transactions/data/mutations'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { removeEveryday, saveEveryday } = await import('./everyday')
const { createBudget } = await import('#/features/transactions/data/mutations')

const draft: BudgetDraft = {
  scopeType: 'category',
  categoryId: 'groceries',
  walletId: null,
  period: 'monthly',
  customDays: null,
  limit: 200000,
  currency: 'SAR',
  excludesBills: true,
  inPlan: true,
}

beforeEach(async () => {
  await db.budgets.clear()
  await db.outbox.clear()
})

describe('saveEveryday', () => {
  it('creates a budget counted in the plan, and queues it', async () => {
    await saveEveryday(null, draft)
    const [row] = await db.budgets.toArray()
    expect(row).toMatchObject({
      categoryId: 'groceries',
      inPlan: true,
      excludesBills: true,
    })
    const [entry] = await db.outbox.toArray()
    expect(entry).toMatchObject({ op: 'create', entity: 'budget', id: row.id })
    expect(entry.payload).toMatchObject({ in_plan: true })
  })

  it('takes over the category’s budget instead of adding a second', async () => {
    const id = await createBudget({ ...draft, limit: 100000, inPlan: false })
    await saveEveryday(null, draft)
    expect(await db.budgets.toArray()).toMatchObject([
      { id, limit: 200000, inPlan: true },
    ])
  })

  it('never lets an account or overall budget count in the plan', async () => {
    await createBudget({ ...draft, scopeType: 'overall', categoryId: null })
    const [row] = await db.budgets.toArray()
    expect(row.inPlan).toBe(false)
  })
})

describe('removeEveryday', () => {
  it('keeps the budget as a plain cap', async () => {
    await saveEveryday(null, draft)
    const [{ id }] = await db.budgets.toArray()
    await removeEveryday(id)
    expect(await db.budgets.get(id)).toMatchObject({
      limit: 200000,
      inPlan: false,
      excludesBills: true,
      deleted: 0,
    })
  })
})
