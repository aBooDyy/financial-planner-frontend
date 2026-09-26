import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalDb, db } from '#/db/db'
import type { InboundImport } from '#/features/inbound-imports/api/types'

/**
 * The inbound-import delta. The stream carries every status while the cache answers only
 * "what is waiting for review", so the interesting case is an import someone else already
 * acted on: it must leave the cache, which the old pending-only list could never say.
 */

const api = { importChanges: vi.fn(), listImports: vi.fn() }

vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: {
    importChanges: (...args: unknown[]) => api.importChanges(...args),
    listImports: (...args: unknown[]) => api.listImports(...args),
  },
}))

const { pullInboundImportsDelta } = await import('./sync')
const { useSessionStore } = await import('#/stores/session')

const anImport = (
  id: string,
  status: InboundImport['status'] = 'pending',
): InboundImport => ({
  id,
  source: 'inbox',
  connectionId: 'c1',
  keyId: null,
  ruleId: null,
  merchantId: null,
  sourceRef: 'alerts@bank.example',
  sourceLabel: null,
  subject: 'Purchase',
  occurredOn: '2026-09-01',
  amount: 4200,
  currency: 'SAR',
  suggestedMerchant: null,
  suggestedCategory: null,
  suggestedSubcategory: null,
  suggestedType: null,
  suggestedWalletId: null,
  rawPreview: null,
  hasBody: true,
  bodyFormat: 'text',
  status,
  transactionId: null,
  createdAt: '2026-09-01T00:00:00Z',
  version: `v-${id}`,
})

const changesPage = (over: Record<string, unknown> = {}) => ({
  asOf: '2026-09-22T10:00:00Z',
  items: [] as InboundImport[],
  deletedIds: [] as string[],
  complete: true,
  cursor: null,
  fullResyncRequired: false,
  ...over,
})

const watermark = () =>
  db.syncState.get('user-a:inboundImport').then((row) => row?.since ?? null)

beforeEach(async () => {
  api.importChanges.mockReset()
  api.listImports.mockReset()
  useSessionStore.getState().setUser({
    id: 'user-a',
    email: 'a@example.com',
    onboardedAt: '2026-01-01T00:00:00Z',
    name: 'A',
    createdAt: '',
    updatedAt: '',
    version: 'v1',
  })
  await db.transaction('rw', [db.inboundImports, db.syncState], async () => {
    await Promise.all([db.inboundImports.clear(), db.syncState.clear()])
  })
})

describe('pullInboundImportsDelta', () => {
  it('caches what is pending and evicts what has been acted on elsewhere', async () => {
    await db.inboundImports.put(anImport('i-confirmed'))
    await db.syncState.put({
      id: 'user-a:inboundImport',
      since: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    })
    api.importChanges.mockResolvedValue(
      changesPage({
        items: [anImport('i-new'), anImport('i-confirmed', 'confirmed')],
        deletedIds: ['i-purged'],
      }),
    )

    await pullInboundImportsDelta()

    expect(await db.inboundImports.get('i-new')).toBeDefined()
    expect(await db.inboundImports.get('i-confirmed')).toBeUndefined()
    expect(await watermark()).toBe('2026-09-22T10:00:00Z')
  })

  it('drops a page that was in flight when sign-out wiped the cache', async () => {
    let answer!: (page: ReturnType<typeof changesPage>) => void
    api.importChanges.mockReturnValue(new Promise((res) => (answer = res)))

    const pull = pullInboundImportsDelta()
    await clearLocalDb()
    answer(changesPage({ items: [anImport('previous-user')] }))
    await pull

    expect(await db.inboundImports.count()).toBe(0)
  })

  it('drops a pending list that was in flight when sign-out wiped the cache', async () => {
    api.importChanges.mockResolvedValue(
      changesPage({ fullResyncRequired: true }),
    )
    let answer!: (rows: InboundImport[]) => void
    api.listImports.mockReturnValue(new Promise((res) => (answer = res)))

    const pull = pullInboundImportsDelta()
    await vi.waitFor(() => expect(api.listImports).toHaveBeenCalled())
    await clearLocalDb()
    answer([anImport('previous-user')])
    await pull

    expect(await db.inboundImports.count()).toBe(0)
  })

  it('joins a pull already running instead of starting a second one', async () => {
    api.importChanges.mockResolvedValue(
      changesPage({ items: [anImport('i1')] }),
    )

    await Promise.all([pullInboundImportsDelta(), pullInboundImportsDelta()])

    expect(api.importChanges).toHaveBeenCalledTimes(1)
    expect(await db.inboundImports.get('i1')).toBeDefined()

    await pullInboundImportsDelta()
    expect(api.importChanges).toHaveBeenCalledTimes(2)
  })

  it('falls back to the pending list when the window is too old, then adopts `as_of`', async () => {
    await db.inboundImports.put(anImport('i-stale'))
    await db.syncState.put({
      id: 'user-a:inboundImport',
      since: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    })
    api.importChanges.mockResolvedValue(
      changesPage({ fullResyncRequired: true, asOf: '2026-09-22T13:00:00Z' }),
    )
    api.listImports.mockResolvedValue([anImport('i-live')])

    await pullInboundImportsDelta()

    expect(api.listImports).toHaveBeenCalledWith('pending')
    expect(await db.inboundImports.get('i-stale')).toBeUndefined()
    expect(await db.inboundImports.get('i-live')).toBeDefined()
    expect(await watermark()).toBe('2026-09-22T13:00:00Z')
  })
})
