import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { CreateCustomCurrencyWire } from '#/features/settings/api/types'

vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { createCustomCurrency, deleteCustomCurrency, updateCustomCurrency } =
  await import('./mutations')

const DRAFT = {
  code: 'pts',
  name: '  Airline Points  ',
  symbol: 'pts',
  minorUnit: 0,
}

const outbox = () => db.outbox.where('entity').equals('customCurrency')

beforeEach(async () => {
  await db.customCurrencies.clear()
  await db.outbox.clear()
})

describe('createCustomCurrency', () => {
  it('writes locally and queues the create, normalizing the code', async () => {
    const id = await createCustomCurrency(DRAFT, 0.05)

    const row = await db.customCurrencies.get(id)
    expect(row).toMatchObject({
      code: 'PTS',
      name: 'Airline Points',
      minorUnit: 0,
      rate: 0.05,
      dirty: 1,
      deleted: 0,
    })

    const [entry] = await outbox().toArray()
    expect(entry).toMatchObject({ op: 'create', id, baseVersion: null })
    const payload = entry.payload as CreateCustomCurrencyWire
    // The rate goes over the wire as a decimal string, like every other rate.
    expect(payload).toMatchObject({ code: 'PTS', minor_unit: 0, rate: '0.05' })
  })
})

describe('updateCustomCurrency', () => {
  it('folds an edit into a create that has not been pushed yet', async () => {
    const id = await createCustomCurrency(DRAFT, 0.05)
    await updateCustomCurrency(id, { name: 'Miles', rate: 0.07 })

    const entries = await outbox().toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].op).toBe('create')
    expect(entries[0].payload).toMatchObject({ name: 'Miles', rate: '0.07' })
    expect((await db.customCurrencies.get(id))?.rate).toBe(0.07)
  })

  it('queues an update against the synced version once one exists', async () => {
    const id = await createCustomCurrency(DRAFT, 0.05)
    await db.outbox.clear()
    await db.customCurrencies.update(id, { version: 'v1', dirty: 0 })

    await updateCustomCurrency(id, { symbol: 'mi' })

    const [entry] = await outbox().toArray()
    expect(entry).toMatchObject({ op: 'update', baseVersion: 'v1' })
    expect(entry.payload).toMatchObject({ version: 'v1', symbol: 'mi' })
  })

  it('ignores an edit to a currency that is gone', async () => {
    await updateCustomCurrency('missing', { name: 'Nope' })
    expect(await outbox().count()).toBe(0)
  })
})

describe('deleteCustomCurrency', () => {
  it('drops a never-synced currency without telling the server', async () => {
    const id = await createCustomCurrency(DRAFT, 0.05)
    await deleteCustomCurrency(id)

    expect(await db.customCurrencies.get(id)).toBeUndefined()
    expect(await outbox().count()).toBe(0)
  })

  it('queues a delete for one the server knows about', async () => {
    const id = await createCustomCurrency(DRAFT, 0.05)
    await db.outbox.clear()
    await db.customCurrencies.update(id, { version: 'v1', dirty: 0 })

    await deleteCustomCurrency(id)

    const [entry] = await outbox().toArray()
    expect(entry).toMatchObject({ op: 'delete', id })
    expect(await db.customCurrencies.get(id)).toBeUndefined()
  })
})
