import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { identityKey } from '#/features/merchants/data/matching'
import type { LocalMerchant } from '#/db/types'
import type { CreateTransactionWire } from '#/features/transactions/api/types'
import { buildRows } from './csv/rows'
import { normalizeKey } from './matching'
import { testContext, testMapping } from './__fixtures__/mapping'
import { emptyAliases } from './types'
import type { Mapping } from './types'

const schedulePush = vi.fn()
const create = vi.fn()

vi.mock('#/db/sync', () => ({ schedulePush: () => schedulePush() }))
vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transactionsApi: {
    create: (...args: unknown[]) => create(...args),
    list: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  budgetsApi: { list: vi.fn() },
  recurringsApi: { list: vi.fn() },
}))

const { CHUNK_SIZE, commitImport, rowsSource } = await import('./commit')
const { rowReader } = await import('./rowScan')
const { batchSource } = await import('./batches')
const { pushSpendingEntry } = await import('#/features/transactions/data/sync')

const meta = {
  label: 'statement.csv',
  templateId: null,
  rowCount: 0,
  skippedDuplicates: 0,
  errorCount: 0,
}

const day = (n: number): string =>
  `2026-06-${String((n % 28) + 1).padStart(2, '0')}`

/** A file of plain, distinct rows: date · description · signed amount. */
const plainMatrix = (count: number): string[][] =>
  Array.from({ length: count }, (_, at) => [
    day(at),
    `Shop ${at}`,
    `-${(at + 1) / 100}`,
  ])

const rowsFor = (matrix: string[][], mapping: Mapping) =>
  rowsSource(buildRows(matrix, mapping, testContext()))

const merchant = (id: string, name: string): LocalMerchant => ({
  id,
  displayName: name,
  learnedCategory: null,
  learnedSubcategory: null,
  learnedType: null,
  timesSeen: 0,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

beforeEach(async () => {
  schedulePush.mockClear()
  create.mockReset()
  await Promise.all([
    db.transactions.clear(),
    db.outbox.clear(),
    db.balanceNodes.clear(),
    db.categories.clear(),
    db.merchants.clear(),
    db.merchantAliases.clear(),
    db.importBatches.clear(),
  ])
})

describe('commitImport', () => {
  it('writes one transaction and one outbox create per row, all marked with the batch', async () => {
    const mapping = testMapping()
    const rows = rowsFor(plainMatrix(300), mapping)
    const seen: number[] = []

    const { batch } = await commitImport(
      rows,
      mapping,
      { ...meta, rowCount: 300 },
      (done) => seen.push(done),
    )

    const written = await db.transactions.toArray()
    const queued = await db.outbox.toArray()
    expect(written).toHaveLength(300)
    expect(queued).toHaveLength(300)
    expect(queued.every((e) => e.op === 'create')).toBe(true)
    expect(queued.every((e) => e.entity === 'transaction')).toBe(true)
    expect(written.every((tx) => tx.source === batchSource(batch.id))).toBe(
      true,
    )
    expect(
      queued.every(
        (e) =>
          (e.payload as CreateTransactionWire).source === `csv:${batch.id}`,
      ),
    ).toBe(true)
    // 200-row chunks: progress is reported per chunk, ending on the total.
    expect(seen).toEqual([0, 200, 300])
    expect(batch.importedCount).toBe(300)
    expect(await db.importBatches.get(batch.id)).toMatchObject({
      label: 'statement.csv',
      rowCount: 300,
      undoneAt: null,
    })
  })

  it('pushes once for the whole batch, not once per chunk', async () => {
    const mapping = testMapping()
    await commitImport(rowsFor(plainMatrix(450), mapping), mapping, meta)
    expect(schedulePush).toHaveBeenCalledTimes(1)
  })

  it('leaves excluded and unreadable rows out', async () => {
    const mapping = testMapping()
    const built = buildRows(
      [...plainMatrix(3), ['not a date', 'Broken', 'N/A']],
      mapping,
      testContext(),
    )
    built[0].excluded = true

    const { batch } = await commitImport(rowsSource(built), mapping, meta)

    expect(batch.importedCount).toBe(2)
    expect(await db.transactions.count()).toBe(2)
  })

  it('materialises pending wallets, categories and merchants under the ids the rows carry', async () => {
    await db.merchants.put(merchant('m-known', 'STC'))
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'wallet', 'category'],
      aliases: {
        ...emptyAliases(),
        wallets: {
          [normalizeKey('Savings')]: {
            kind: 'create',
            walletId: 'w-new',
            name: 'Savings',
            currency: 'SAR',
          },
        },
        categories: {
          [normalizeKey('Fuel')]: {
            kind: 'create',
            category: 'fuel',
            subcategory: null,
            parentId: null,
            name: 'Fuel',
            type: 'spend',
          },
        },
        merchants: {
          [normalizeKey('CARREFOUR HYPER')]: {
            kind: 'create',
            merchantId: 'm-new',
            displayName: 'Carrefour',
          },
          [normalizeKey('STC')]: { kind: 'merchant', merchantId: 'm-known' },
        },
      },
    })
    const rows = rowsFor(
      [
        ['2026-06-16', 'CARREFOUR HYPER', '-12.40', 'Savings', 'Fuel'],
        ['2026-06-17', 'STC', '-89.00', 'Savings', 'Fuel'],
      ],
      mapping,
    )

    const { learnedSpellings } = await commitImport(rows, mapping, meta)

    expect(await db.balanceNodes.get('w-new')).toMatchObject({
      kind: 'wallet',
      name: 'Savings',
      amount: 0,
      currency: 'SAR',
    })
    expect((await db.categories.toArray()).map((c) => c.slug)).toEqual(['fuel'])
    expect(await db.merchants.get('m-new')).toMatchObject({
      displayName: 'Carrefour',
    })
    // The file's spelling is filed onto the merchant the user bound it to.
    const learned = await db.merchantAliases
      .where('merchantId')
      .equals('m-known')
      .toArray()
    expect(learned.map((a) => a.normalizedKey)).toEqual([identityKey('STC')])
    expect(learned[0].origin).toBe('import')
    expect(learnedSpellings).toBe(1)

    const written = await db.transactions.orderBy('date').toArray()
    expect(written.map((tx) => tx.walletId)).toEqual(['w-new', 'w-new'])
    expect(written.map((tx) => tx.category)).toEqual(['fuel', 'fuel'])
    expect(written.map((tx) => tx.merchantId)).toEqual(['m-new', 'm-known'])
  })

  it('creates a mapped-to subcategory under its parent, and the rows carry the pair', async () => {
    await db.categories.put({
      id: 'cat-groceries',
      parentId: null,
      slug: 'groceries',
      name: 'Groceries',
      type: 'spend',
      color: '#1F9D6B',
      icon: null,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 'v1',
      dirty: 0,
      deleted: 0,
    })
    const mapping = testMapping({
      roles: ['date', 'merchant', 'amount', 'category'],
      aliases: {
        ...emptyAliases(),
        categories: {
          [normalizeKey('FARMERS MKT')]: {
            kind: 'create',
            category: 'groceries',
            subcategory: 'farmers_market',
            parentId: 'cat-groceries',
            name: 'Farmers market',
            type: 'spend',
          },
        },
      },
    })
    const rows = rowsFor(
      [['2026-06-16', 'Stall 4', '-12.40', 'FARMERS MKT']],
      mapping,
    )

    await commitImport(rows, mapping, meta)

    const child = (await db.categories.toArray()).find(
      (c) => c.slug === 'farmers_market',
    )
    expect(child).toMatchObject({
      parentId: 'cat-groceries',
      name: 'Farmers market',
      // Blank means "inherit the parent's", which is what the create service stores.
      color: '#1F9D6B',
    })
    const [written] = await db.transactions.toArray()
    expect(written).toMatchObject({
      category: 'groceries',
      subcategory: 'farmers_market',
    })
  })

  it('commits offline and the queued creates drain unchanged when the network returns', async () => {
    const mapping = testMapping()
    const { batch } = await commitImport(
      rowsFor(plainMatrix(5), mapping),
      mapping,
      meta,
    )

    create.mockImplementation((wire: CreateTransactionWire) => ({
      ...wire,
      type: wire.type === 'SPEND' ? 'spend' : 'income',
      walletId: wire.wallet_id,
      goalId: wire.goal_id,
      merchantId: wire.merchant_id,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T10:00:00.000Z',
      version: 'server-v1',
    }))

    for (const entry of await db.outbox.orderBy('seq').toArray()) {
      await pushSpendingEntry(entry)
    }

    expect(create).toHaveBeenCalledTimes(5)
    expect(await db.outbox.count()).toBe(0)
    const written = await db.transactions.toArray()
    expect(written).toHaveLength(5)
    expect(written.every((tx) => tx.dirty === 0)).toBe(true)
    // The marker survives the round trip — it is what undo keys off.
    expect(
      await db.transactions
        .where('source')
        .equals(batchSource(batch.id))
        .count(),
    ).toBe(5)
  })

  it('streams a 5 000-row file in chunks instead of holding it', async () => {
    const mapping = testMapping()
    const matrix = plainMatrix(5000)
    const reader = rowReader({
      matrix,
      mapping,
      context: testContext(),
      merchants: { merchants: [], aliases: [] },
    })
    let built = 0
    let widest = 0
    const source = {
      total: matrix.length,
      cellsAt: (at: number) => matrix[at],
      rowsAt: (start: number, end: number) => {
        widest = Math.max(widest, end - start)
        built += end - start
        return Array.from({ length: end - start }, (_unused, at) =>
          reader.at(start + at),
        )
      },
    }

    const { batch } = await commitImport(source, mapping, {
      ...meta,
      rowCount: matrix.length,
    })

    expect(batch.importedCount).toBe(5000)
    expect(await db.transactions.count()).toBe(5000)
    expect(await db.outbox.count()).toBe(5000)
    // Every row was built exactly once, and never more than one chunk of them at a time.
    expect(built).toBe(5000)
    expect(widest).toBe(CHUNK_SIZE)
  }, 120000)
})
