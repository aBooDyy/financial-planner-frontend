import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'

/**
 * Pull and push never overlap. A full pull fetched before a push lands and applied after it
 * re-applies the server's older state over the row the push just settled clean.
 */

const events: string[] = []
let releasePull: () => void = () => {}

const quiet = () => Promise.resolve()
const track = (name: string) => () => {
  events.push(name)
  return Promise.resolve()
}

vi.mock('#/features/wallets/api/walletsApi', () => ({
  walletsApi: {
    listNodes: () => Promise.resolve([]),
    getSettings: () =>
      Promise.resolve({
        baseCurrency: 'SAR',
        version: 'v1',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    listRates: () => Promise.resolve([]),
  },
}))
vi.mock('#/features/categories/data/sync', () => ({
  pullCategories: quiet,
  pushCategoryEntry: quiet,
}))
vi.mock('#/features/settings/data/sync', () => ({
  pullCustomCurrencies: quiet,
  pushSettingsEntry: quiet,
}))
vi.mock('#/features/goals/data/sync', () => ({
  pullGoalsAll: quiet,
  pushGoalsEntry: quiet,
}))
vi.mock('#/features/bills/data/sync', () => ({
  pullBills: quiet,
  pushBillsEntry: quiet,
}))
vi.mock('#/features/setAsides/data/sync', () => ({
  pullSetAsides: () => {
    events.push('pull:start')
    return new Promise<void>((resolve) => {
      releasePull = () => {
        events.push('pull:end')
        resolve()
      }
    })
  },
  pushSetAsidesEntry: async (entry: { seq: number }) => {
    events.push('push')
    await db.outbox.delete(entry.seq)
  },
}))
vi.mock('#/features/merchants/data/sync', () => ({
  pullMerchantsAll: quiet,
  pushMerchantsEntry: quiet,
}))
vi.mock('#/features/import/data/sync', () => ({
  pullImportTemplates: quiet,
  pushImportTemplatesEntry: quiet,
}))
vi.mock('#/features/inbound-imports/data/sync', () => ({
  pullInboundImportsDelta: quiet,
}))
vi.mock('#/features/transactions/data/sync', () => ({
  pullSpendingAll: quiet,
  pushSpendingEntry: quiet,
  pushTransactionCreates: quiet,
  pushTransactionDeletes: quiet,
}))
vi.mock('#/features/transactions/data/transferSync', () => ({
  pushTransferCreates: quiet,
  pushTransferDeletes: quiet,
  pushTransferEntry: quiet,
}))
vi.mock('#/features/planned/data/sync', () => ({
  pullPlannedDelta: track('planned'),
  pushPlannedEntry: quiet,
  pushPlannedCreates: quiet,
}))

const { flushOutbox, pullAll } = await import('./sync')

const turns = async (n = 10) => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

beforeEach(async () => {
  events.length = 0
  await db.outbox.clear()
})

describe('pull and push', () => {
  it('holds a push until the pull in progress has applied what it fetched', async () => {
    await db.outbox.add({
      op: 'update',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: 'v1',
      createdAt: '',
    })

    const pulling = pullAll()
    await turns()
    const pushing = flushOutbox()
    await turns()
    expect(events).not.toContain('push')

    releasePull()
    await Promise.all([pulling, pushing])

    expect(events.indexOf('pull:end')).toBeLessThan(events.indexOf('push'))
  })

  it('holds a pull until the push in progress has settled', async () => {
    await db.outbox.add({
      op: 'update',
      entity: 'setAside',
      id: 'a1',
      payload: {},
      baseVersion: 'v1',
      createdAt: '',
    })

    const pushing = flushOutbox()
    const pulling = pullAll()
    await turns()
    releasePull()
    await Promise.all([pulling, pushing])

    expect(events.indexOf('push')).toBeLessThan(events.indexOf('pull:start'))
  })
})
