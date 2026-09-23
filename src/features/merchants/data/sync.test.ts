import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type {
  LocalMerchant,
  LocalMerchantAlias,
  LocalTransaction,
  OutboxEntry,
} from '#/db/types'
import type { Merchant, MerchantAlias } from '#/features/merchants/api/types'
import { ApiError } from '#/lib/apiError'

const api = {
  list: vi.fn(),
  changes: vi.fn(),
  aliasChanges: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  addAliases: vi.fn(),
  removeAlias: vi.fn(),
  merge: vi.fn(),
  remove: vi.fn(),
}
const listTransactions = vi.fn()

vi.mock('#/features/merchants/api/merchantsApi', () => ({
  merchantsApi: new Proxy(
    {},
    {
      get:
        (_t, key: string) =>
        (...args: unknown[]) =>
          api[key as keyof typeof api](...args),
    },
  ),
}))
vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi: { list: (...args: unknown[]) => listTransactions(...args) },
  budgetsApi: { list: vi.fn() },
  recurringsApi: { list: vi.fn() },
}))
vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { pullMerchants, pullMerchantsAll, pushMerchantsEntry } =
  await import('./sync')
const { useSessionStore } = await import('#/stores/session')
const { mergeMerchants } = await import('./mutations')

const TEMP = 'temp-id'
const WINNER = 'winner-id'

const aliasTaken = (winnerId: string, key: string) =>
  new ApiError({
    code: 'merchants.alias.taken',
    message: 'taken',
    status: 409,
    details: [
      { field: 'merchant_id', code: 'merchants.alias.taken', value: winnerId },
      { field: 'normalized_key', code: 'merchants.alias.taken', value: key },
    ],
  })

const localMerchant = (over: Partial<LocalMerchant> = {}): LocalMerchant => ({
  id: TEMP,
  displayName: 'Carrefour Hyper 4471',
  learnedCategory: null,
  learnedSubcategory: null,
  learnedType: null,
  timesSeen: 0,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 1,
  deleted: 0,
  ...over,
})

const localAlias = (
  id: string,
  merchantId: string,
  normalizedKey: string,
): LocalMerchantAlias => ({
  id,
  merchantId,
  normalizedKey,
  rawSample: normalizedKey,
  origin: 'manual',
  createdAt: '',
  version: '',
  dirty: 1,
  deleted: 0,
})

const localTx = (
  id: string,
  over: Partial<LocalTransaction> = {},
): LocalTransaction => ({
  id,
  type: 'spend',
  amount: 1000,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  merchantId: TEMP,
  date: '2026-06-01',
  note: null,
  source: null,
  transferId: null,
  createdAt: '',
  updatedAt: '',
  version: 'tx-v1',
  dirty: 1,
  deleted: 0,
  ...over,
})

const serverAlias = (
  id: string,
  merchantId: string,
  key: string,
): MerchantAlias => ({
  id,
  merchantId,
  normalizedKey: key,
  rawSample: key,
  origin: 'manual',
  createdAt: '',
  version: 'a-v1',
})

const serverMerchant = (over: Partial<Merchant> = {}): Merchant => ({
  id: WINNER,
  displayName: 'Carrefour',
  learnedCategory: 'groceries',
  learnedSubcategory: null,
  learnedType: 'spend',
  timesSeen: 9,
  timesConfirmed: 3,
  lastSeenAt: null,
  autoCategorize: true,
  aliases: [serverAlias('sa1', WINNER, 'carrefour')],
  createdAt: '',
  updatedAt: '',
  version: 'm-v1',
  ...over,
})

beforeEach(async () => {
  for (const key of Object.keys(api)) {
    api[key as keyof typeof api].mockReset()
  }
  listTransactions.mockReset().mockResolvedValue([])
  useSessionStore.getState().setUser({
    id: 'user-a',
    email: 'a@example.com',
    name: 'A',
    createdAt: '',
    updatedAt: '',
    version: 'v1',
  })
  await db.transaction(
    'rw',
    [
      db.merchants,
      db.merchantAliases,
      db.transactions,
      db.outbox,
      db.syncState,
    ],
    async () => {
      await Promise.all([
        db.merchants.clear(),
        db.merchantAliases.clear(),
        db.transactions.clear(),
        db.outbox.clear(),
        db.syncState.clear(),
      ])
    },
  )
})

/** One complete page of a delta, with nothing in it unless the caller says otherwise. */
const changesPage = (over: Record<string, unknown> = {}) => ({
  asOf: '2026-09-22T10:00:00Z',
  items: [],
  deletedIds: [],
  complete: true,
  cursor: null,
  fullResyncRequired: false,
  ...over,
})

/** Seed the state a client holds right after inventing a merchant offline. */
async function seedPendingMerchant(): Promise<OutboxEntry> {
  await db.merchants.put(localMerchant())
  await db.merchantAliases.bulkPut([
    localAlias('a-collide', TEMP, 'carrefour'),
    localAlias('a-new', TEMP, 'carrefour hyper 4471'),
  ])
  await db.transactions.bulkPut([
    localTx('tx-queued'),
    localTx('tx-pushed', { dirty: 0 }),
  ])
  await db.outbox.add({
    op: 'create',
    entity: 'transaction',
    id: 'tx-queued',
    payload: { id: 'tx-queued', merchant_id: TEMP, amount: 1000 },
    baseVersion: null,
    createdAt: '',
  })
  const seq = await db.outbox.add({
    op: 'create',
    entity: 'merchant',
    id: TEMP,
    payload: { id: TEMP, display_name: 'Carrefour Hyper 4471', aliases: [] },
    baseVersion: null,
    createdAt: '',
  })
  return (await db.outbox.get(seq)) as OutboxEntry
}

describe('adopt-and-remap on 409 merchants.alias.taken', () => {
  it('moves everything local onto the winner without a second round of updates', async () => {
    const entry = await seedPendingMerchant()
    api.create.mockRejectedValue(aliasTaken(WINNER, 'carrefour'))
    api.list.mockResolvedValue([serverMerchant()])

    await pushMerchantsEntry(entry)

    // The temp merchant never existed server-side: it and its queued create are gone.
    expect(await db.merchants.get(TEMP)).toBeUndefined()
    expect(
      await db.outbox.where('[entity+id]').equals(['merchant', TEMP]).count(),
    ).toBe(0)

    // Local rows point at the winner.
    const txs = await db.transactions.toArray()
    expect(txs.map((t) => t.merchantId)).toEqual([WINNER, WINNER])

    // The still-queued create is rewritten in place — no extra op for that row.
    const queued = await db.outbox
      .where('[entity+id]')
      .equals(['transaction', 'tx-queued'])
      .toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0].op).toBe('create')
    expect((queued[0].payload as { merchant_id: string }).merchant_id).toBe(
      WINNER,
    )

    // Only the already-pushed row earns a real PATCH.
    const patches = await db.outbox
      .where('[entity+id]')
      .equals(['transaction', 'tx-pushed'])
      .toArray()
    expect(patches).toHaveLength(1)
    expect(patches[0].op).toBe('update')
    expect(patches[0].baseVersion).toBe('tx-v1')
    expect((patches[0].payload as { merchant_id: string }).merchant_id).toBe(
      WINNER,
    )

    // Its spellings follow it and queue as ordinary alias adds.
    const aliases = await db.merchantAliases.toArray()
    expect(aliases.every((a) => a.merchantId === WINNER)).toBe(true)
    const aliasOps = await db.outbox
      .filter((e) => e.entity === 'merchantAlias')
      .toArray()
    expect(aliasOps.map((e) => e.id).sort()).toEqual(['a-collide', 'a-new'])

    // The winner was pulled, since it was invented on another device.
    expect(api.list).toHaveBeenCalledTimes(1)
    expect((await db.merchants.get(WINNER))?.displayName).toBe('Carrefour')
  })

  it('does not pull when the winner is already held locally', async () => {
    const entry = await seedPendingMerchant()
    await db.merchants.put(
      localMerchant({ id: WINNER, dirty: 0, version: 'm-v1' }),
    )
    api.create.mockRejectedValue(aliasTaken(WINNER, 'carrefour'))

    await pushMerchantsEntry(entry)

    expect(api.list).not.toHaveBeenCalled()
    expect(await db.merchants.get(TEMP)).toBeUndefined()
  })

  it('drops the op rather than looping when no winner is named', async () => {
    const entry = await seedPendingMerchant()
    api.create.mockRejectedValue(
      new ApiError({
        code: 'merchants.alias.taken',
        message: 'taken',
        status: 409,
      }),
    )

    await pushMerchantsEntry(entry)

    expect(
      await db.outbox.where('[entity+id]').equals(['merchant', TEMP]).count(),
    ).toBe(0)
  })

  it('replaces the local alias rows with the server ids on the ordinary path', async () => {
    const entry = await seedPendingMerchant()
    api.create.mockResolvedValue(
      serverMerchant({
        id: TEMP,
        aliases: [serverAlias('sa9', TEMP, 'carrefour hyper 4471')],
      }),
    )

    await pushMerchantsEntry(entry)

    const aliases = await db.merchantAliases.toArray()
    expect(aliases.map((a) => a.id)).toEqual(['sa9'])
    expect(
      await db.outbox.where('[entity+id]').equals(['merchant', TEMP]).count(),
    ).toBe(0)
  })
})

describe('pullMerchants', () => {
  it('keeps unpushed local rows and drops the ones the server no longer has', async () => {
    await db.merchants.bulkPut([
      localMerchant({ id: 'stale', dirty: 0 }),
      localMerchant({ id: 'mine', dirty: 1 }),
    ])
    await db.merchantAliases.put(localAlias('a-stale', 'stale', 'gone'))
    api.list.mockResolvedValue([serverMerchant()])

    await pullMerchants()

    expect(await db.merchants.get('stale')).toBeUndefined()
    expect(await db.merchantAliases.get('a-stale')).toBeUndefined()
    expect(await db.merchants.get('mine')).toBeDefined()
    expect((await db.merchants.get(WINNER))?.autoCategorize).toBe(true)
  })
})

describe('pullMerchantsAll', () => {
  const atWatermark = async () => {
    await db.syncState.bulkPut([
      {
        id: 'user-a:merchant',
        since: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'user-a:merchantAlias',
        since: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ])
  }

  it('drops a spelling the alias stream tombstoned, on a merchant that never changed', async () => {
    await db.merchants.put(localMerchant({ id: WINNER, dirty: 0 }))
    await db.merchantAliases.put({
      ...localAlias('sa9', WINNER, 'carrefour 402'),
      dirty: 0,
    })
    await atWatermark()
    api.changes.mockResolvedValue(changesPage())
    api.aliasChanges.mockResolvedValue(changesPage({ deletedIds: ['sa9'] }))

    await pullMerchantsAll()

    // The merchant's own row never moved, so only its aliases' stream could say this.
    expect(await db.merchantAliases.get('sa9')).toBeUndefined()
    expect(await db.merchants.get(WINNER)).toBeDefined()
  })

  it('takes a merchant tombstone with its aliases, and leaves an unpushed one alone', async () => {
    await db.merchants.bulkPut([
      localMerchant({ id: 'gone', dirty: 0 }),
      localMerchant({ id: 'mine', dirty: 1 }),
    ])
    await db.merchantAliases.put({
      ...localAlias('a-gone', 'gone', 'gone key'),
      dirty: 0,
    })
    await atWatermark()
    api.changes.mockResolvedValue(changesPage({ deletedIds: ['gone', 'mine'] }))
    api.aliasChanges.mockResolvedValue(changesPage())

    await pullMerchantsAll()

    expect(await db.merchants.get('gone')).toBeUndefined()
    expect(await db.merchantAliases.get('a-gone')).toBeUndefined()
    expect(await db.merchants.get('mine')).toBeDefined()
  })

  it('reconciles the whole alias set of a merchant the page delivers', async () => {
    await db.merchants.put(localMerchant({ id: WINNER, dirty: 0 }))
    await db.merchantAliases.put({
      ...localAlias('sa-old', WINNER, 'dropped key'),
      dirty: 0,
    })
    await atWatermark()
    api.changes.mockResolvedValue(changesPage({ items: [serverMerchant()] }))
    api.aliasChanges.mockResolvedValue(changesPage())

    await pullMerchantsAll()

    expect(await db.merchantAliases.get('sa-old')).toBeUndefined()
    expect(await db.merchantAliases.get('sa1')).toBeDefined()
  })
})

describe('mergeMerchants', () => {
  it('sends the source version and takes server truth afterwards', async () => {
    await db.merchants.bulkPut([
      localMerchant({ id: 'source', dirty: 0, version: 'src-v1' }),
      localMerchant({ id: WINNER, dirty: 0, version: 'm-v0' }),
    ])
    await db.merchantAliases.put(localAlias('a-src', 'source', 'carrefour 402'))
    api.merge.mockResolvedValue(serverMerchant())
    api.list.mockResolvedValue([serverMerchant()])

    await mergeMerchants('source', WINNER)

    expect(api.merge).toHaveBeenCalledWith({
      source_id: 'source',
      target_id: WINNER,
      version: 'src-v1',
    })
    expect(await db.merchants.get('source')).toBeUndefined()
    expect(await db.merchantAliases.get('a-src')).toBeUndefined()
    expect((await db.merchants.get(WINNER))?.version).toBe('m-v1')
    expect(listTransactions).toHaveBeenCalled()
  })

  it('refuses to merge a merchant into itself', async () => {
    await db.merchants.put(localMerchant({ id: 'source' }))
    await mergeMerchants('source', 'source')
    expect(api.merge).not.toHaveBeenCalled()
  })
})
