// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sync lifecycle. One pull fans out to every collection, so what starts it — and how
 * often — decides whether opening a page fetches that page's data or the whole app's.
 */

const pulls: string[] = []
const track =
  (name: string) =>
  (...unused: Array<unknown>) => {
    void unused
    pulls.push(name)
    return Promise.resolve()
  }

vi.mock('#/features/wallets/api/walletsApi', () => ({
  walletsApi: {
    listNodes: () => {
      pulls.push('nodes')
      return Promise.resolve([])
    },
    getSettings: () => {
      pulls.push('settings')
      return Promise.resolve({
        baseCurrency: 'SAR',
        version: 'v1',
        updatedAt: '2026-01-01T00:00:00Z',
      })
    },
    listRates: () => {
      pulls.push('rates')
      return Promise.resolve([])
    },
  },
}))

vi.mock('#/features/categories/data/sync', () => ({
  pullCategories: track('categories'),
  pushCategoryEntry: track('push:categories'),
}))
vi.mock('#/features/settings/data/sync', () => ({
  pullCustomCurrencies: track('customCurrencies'),
  pushSettingsEntry: track('push:settings'),
}))
vi.mock('#/features/goals/data/sync', () => ({
  pullGoalsAll: track('goals'),
  pushGoalsEntry: track('push:goals'),
}))
vi.mock('#/features/merchants/data/sync', () => ({
  pullMerchantsAll: track('merchants'),
  pushMerchantsEntry: track('push:merchants'),
}))
vi.mock('#/features/import/data/sync', () => ({
  pullImportTemplates: track('importTemplates'),
  pushImportTemplatesEntry: track('push:importTemplates'),
}))
vi.mock('#/features/inbound-imports/data/sync', () => ({
  pullInboundImportsDelta: track('inboundImports'),
}))
vi.mock('#/features/transactions/data/sync', () => ({
  pullSpendingAll: track('spending'),
  pushSpendingEntry: track('push:spending'),
  pushTransactionCreates: track('push:txCreates'),
}))
vi.mock('#/features/planned/data/sync', () => ({
  pullPlannedDelta: track('planned'),
  pushPlannedEntry: track('push:planned'),
  pushPlannedCreates: track('push:plannedCreates'),
}))

/**
 * Let a pull finish. The mocked endpoints resolve at once, but the Dexie writes behind them
 * need real turns of the event loop, and `pullAll` only drops its single-flight latch once
 * those land.
 */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

const collections = [
  'nodes',
  'settings',
  'rates',
  'categories',
  'customCurrencies',
  'goals',
  'merchants',
  'importTemplates',
  'spending',
  'planned',
  'inboundImports',
]

beforeEach(() => {
  pulls.length = 0
  vi.useRealTimers()
})

describe('startSync', () => {
  it('pulls every collection once per start', async () => {
    const { startSync } = await import('./sync')
    const stop = startSync()
    await settle()

    for (const name of collections) {
      expect(pulls.filter((p) => p === name)).toHaveLength(1)
    }
    stop()
  })

  it('is idempotent — a second caller does not start rival loops', async () => {
    const { startSync } = await import('./sync')
    const stop = startSync()
    await settle()
    const afterFirst = pulls.length

    const stopSecond = startSync()
    await settle()

    expect(pulls).toHaveLength(afterFirst)
    stopSecond()
    stop()
  })

  it('does not re-pull when the tab regains focus inside the throttle window', async () => {
    const { startSync } = await import('./sync')
    const stop = startSync()
    await settle()
    const afterStart = pulls.length

    document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(pulls).toHaveLength(afterStart)
    stop()
  })

  it('stops pulling once torn down', async () => {
    const { startSync } = await import('./sync')
    const stop = startSync()
    await settle()
    stop()
    const afterStop = pulls.length

    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(pulls).toHaveLength(afterStop)
  })

  it('can be restarted after teardown — a new session resumes syncing', async () => {
    const { startSync } = await import('./sync')
    startSync()()
    await settle()
    pulls.length = 0

    const stop = startSync()
    await settle()

    expect(pulls.filter((p) => p === 'nodes')).toHaveLength(1)
    stop()
  })

  it('counts a pull of the planner’s inputs only once they are all home', async () => {
    const { usePullStateStore } = await import('./pullState')
    const before = usePullStateStore.getState().plannerInputsPulled
    const { startSync } = await import('./sync')
    const stop = startSync()
    await settle()

    expect(usePullStateStore.getState().plannerInputsPulled).toBe(before + 1)
    stop()
  })
})
