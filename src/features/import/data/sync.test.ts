import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import { ApiError } from '#/lib/apiError'
import { testDialect } from './__fixtures__/mapping'
import { configFromDraft } from './templates'
import { DEFAULT_DEDUPE, emptyAliases } from './types'
import type { LocalImportTemplate, OutboxEntry } from '#/db/types'
import type { ImportTemplateWire } from '#/features/import/api/types'
import type { MappingDraft } from './mapping'

const api = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }

vi.mock('#/features/import/api/importTemplatesApi', () => ({
  importTemplatesApi: new Proxy(
    {},
    {
      get:
        (_t, key: string) =>
        (...args: unknown[]) =>
          api[key as keyof typeof api](...args),
    },
  ),
}))
vi.mock('#/db/sync', () => ({ schedulePush: vi.fn() }))

const { pullImportTemplates, pushImportTemplatesEntry } = await import('./sync')
const {
  createImportTemplate,
  deleteImportTemplate,
  recordTemplateUse,
  remapTemplateCategories,
  renameImportTemplate,
  saveTemplateForImport,
} = await import('./mutations')
const { toImportTemplate } = await import('#/features/import/api/types')

const draft: MappingDraft = {
  dialect: testDialect(),
  dateFormat: 'DD/MM/YYYY',
  dateAmbiguous: false,
  roles: ['date', 'merchant', 'amount'],
  amountKind: 'signed',
  negativeMeans: 'spend',
  amountUnit: 'major',
  defaults: {
    walletId: 'w1',
    currency: 'SAR',
    type: 'spend',
    categoryIds: { spend: 'cat-other', income: 'cat-other_income' },
  },
  aliases: emptyAliases(),
  dedupe: DEFAULT_DEDUPE,
}

const config = configFromDraft(draft)
const SIGNATURE = 'csv1:deadbeef'

const wire = (over: Partial<ImportTemplateWire> = {}): ImportTemplateWire => ({
  id: 't1',
  name: 'Al Rajhi',
  source_kind: 'CSV',
  signature: SIGNATURE,
  config: JSON.stringify(config),
  last_used_at: '2026-09-01T00:00:00Z',
  use_count: 2,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  version: 'v-server',
  ...over,
})

const served = (over: Partial<ImportTemplateWire> = {}) =>
  toImportTemplate(wire(over))

const local = (
  over: Partial<LocalImportTemplate> = {},
): LocalImportTemplate => ({
  id: 't1',
  name: 'Al Rajhi',
  sourceKind: 'csv',
  signature: SIGNATURE,
  config,
  lastUsedAt: null,
  useCount: 0,
  nameConflict: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  version: 'v0',
  dirty: 1,
  deleted: 0,
  ...over,
})

const nameTaken = () =>
  new ApiError({
    code: 'import.template.name_taken',
    message: 'taken',
    status: 409,
  })

const versionConflict = () =>
  new ApiError({ code: 'common.conflict', message: 'stale', status: 409 })

const outbox = (): Promise<OutboxEntry[]> => db.outbox.orderBy('seq').toArray()

const drain = async (): Promise<void> => {
  for (const entry of await outbox()) await pushImportTemplatesEntry(entry)
}

beforeEach(async () => {
  vi.clearAllMocks()
  await db.importTemplates.clear()
  await db.outbox.clear()
})

describe('createImportTemplate', () => {
  it('writes locally, queues one create, and stores server truth on push', async () => {
    const created = await createImportTemplate({
      name: 'Al Rajhi',
      signature: SIGNATURE,
      config,
    })
    expect(created.useCount).toBe(1)
    const queued = await outbox()
    expect(queued).toHaveLength(1)
    expect(queued[0].payload).toMatchObject({
      id: created.id,
      source_kind: 'CSV',
      signature: SIGNATURE,
      config: JSON.stringify(config),
    })

    api.create.mockResolvedValue(served({ id: created.id }))
    await drain()

    const row = await db.importTemplates.get(created.id)
    expect(row?.version).toBe('v-server')
    expect(row?.dirty).toBe(0)
    expect(await outbox()).toHaveLength(0)
  })

  it('refuses a name this device already uses, without a round trip', async () => {
    await createImportTemplate({
      name: 'Al Rajhi',
      signature: SIGNATURE,
      config,
    })
    await expect(
      createImportTemplate({
        name: ' Al Rajhi ',
        signature: SIGNATURE,
        config,
      }),
    ).rejects.toMatchObject({ code: 'import.template.name_taken' })
    expect(await db.importTemplates.count()).toBe(1)
  })
})

describe('remapTemplateCategories', () => {
  it('points a queued template at the id the server gave its category', async () => {
    const created = await createImportTemplate({
      name: 'Al Rajhi',
      signature: SIGNATURE,
      config: {
        ...config,
        aliases: {
          ...config.aliases,
          categories: { fuel: { kind: 'category', categoryId: 'local-fuel' } },
        },
      },
    })

    await remapTemplateCategories('local-fuel', 'server-fuel')

    const row = await db.importTemplates.get(created.id)
    expect(row?.config?.aliases.categories.fuel).toEqual({
      kind: 'category',
      categoryId: 'server-fuel',
    })
    const [queued] = await outbox()
    expect(
      JSON.parse((queued.payload as { config: string }).config).aliases
        .categories.fuel.categoryId,
    ).toBe('server-fuel')
  })
})

describe('name_taken on push', () => {
  it('parks the row instead of rebasing — a retry would spin forever', async () => {
    const created = await createImportTemplate({
      name: 'Al Rajhi',
      signature: SIGNATURE,
      config,
    })
    api.create.mockRejectedValue(nameTaken())

    await drain()

    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.list).not.toHaveBeenCalled()
    expect(await outbox()).toHaveLength(0)
    const row = await db.importTemplates.get(created.id)
    expect(row?.nameConflict).toBe(1)
    expect(row?.config).toEqual(config)
  })

  it('renaming a parked row queues its create again', async () => {
    const created = await createImportTemplate({
      name: 'Al Rajhi',
      signature: SIGNATURE,
      config,
    })
    api.create.mockRejectedValueOnce(nameTaken())
    await drain()

    await renameImportTemplate(created.id, 'Al Rajhi — current')
    const queued = await outbox()
    expect(queued).toHaveLength(1)
    expect(queued[0].op).toBe('create')
    expect(queued[0].payload).toMatchObject({ name: 'Al Rajhi — current' })
    expect((await db.importTemplates.get(created.id))?.nameConflict).toBe(0)
  })

  it('parks an update the server refuses by name', async () => {
    await db.importTemplates.put(local({ dirty: 0 }))
    await renameImportTemplate('t1', 'Taken elsewhere')
    api.update.mockRejectedValue(nameTaken())

    await drain()

    expect(api.update).toHaveBeenCalledTimes(1)
    expect(await outbox()).toHaveLength(0)
    expect((await db.importTemplates.get('t1'))?.nameConflict).toBe(1)
  })
})

describe('409 version conflict', () => {
  it('rebases the same partial patch onto the server version and retries once', async () => {
    await db.importTemplates.put(local({ dirty: 0, version: 'v0' }))
    await renameImportTemplate('t1', 'Renamed here')

    api.update.mockRejectedValueOnce(versionConflict())
    api.list.mockResolvedValue([served({ version: 'v-fresh' })])
    api.update.mockResolvedValueOnce(
      served({ name: 'Renamed here', version: 'v2' }),
    )

    await drain()

    expect(api.update).toHaveBeenNthCalledWith(1, 't1', {
      version: 'v0',
      name: 'Renamed here',
    })
    // Only the field this op changed is re-sent — a use bump made elsewhere survives.
    expect(api.update).toHaveBeenNthCalledWith(2, 't1', {
      version: 'v-fresh',
      name: 'Renamed here',
    })
    const row = await db.importTemplates.get('t1')
    expect(row?.name).toBe('Renamed here')
    expect(row?.version).toBe('v2')
    expect(row?.dirty).toBe(0)
    expect(await outbox()).toHaveLength(0)
  })

  it('takes server truth rather than looping when the retry conflicts too', async () => {
    await db.importTemplates.put(local({ dirty: 0 }))
    await renameImportTemplate('t1', 'Renamed here')
    api.update.mockRejectedValue(versionConflict())
    api.list.mockResolvedValue([served({ version: 'v-fresh' })])

    await drain()

    expect((await db.importTemplates.get('t1'))?.name).toBe('Al Rajhi')
    expect(await outbox()).toHaveLength(0)
  })
})

describe('use bumps', () => {
  it('merges into one queued partial patch while offline', async () => {
    await db.importTemplates.put(local({ dirty: 0, useCount: 4 }))
    await renameImportTemplate('t1', 'Renamed')
    await recordTemplateUse('t1')

    const queued = await outbox()
    expect(queued).toHaveLength(1)
    expect(queued[0].payload).toMatchObject({
      version: 'v0',
      name: 'Renamed',
      use_count: 5,
    })
  })
})

describe('deleteImportTemplate', () => {
  it('queues a delete for a synced row and drops a never-synced one outright', async () => {
    await db.importTemplates.put(local({ dirty: 0 }))
    await deleteImportTemplate('t1')
    expect(await db.importTemplates.get('t1')).toBeUndefined()
    expect((await outbox())[0].op).toBe('delete')

    api.remove.mockResolvedValue(undefined)
    await drain()
    expect(await outbox()).toHaveLength(0)

    const created = await createImportTemplate({
      name: 'Local only',
      signature: SIGNATURE,
      config,
    })
    await deleteImportTemplate(created.id)
    expect(await outbox()).toHaveLength(0)
  })
})

describe('pullImportTemplates', () => {
  it('caches a config it cannot read rather than crashing on it', async () => {
    api.list.mockResolvedValue([
      served({ id: 'garbage', config: 'not json at all' }),
      served({ id: 'array', config: '[1,2,3]' }),
      served({ id: 'partial', config: '{"version":1,"roles":["date"]}' }),
    ])

    await pullImportTemplates()

    expect((await db.importTemplates.get('garbage'))?.config).toBeNull()
    expect((await db.importTemplates.get('array'))?.config).toBeNull()
    expect((await db.importTemplates.get('partial'))?.config).toBeNull()
    expect((await db.importTemplates.get('partial'))?.name).toBe('Al Rajhi')
  })

  it('keeps local edits and drops rows the server no longer has', async () => {
    await db.importTemplates.bulkPut([
      local({ id: 'mine', name: 'Mine', dirty: 1 }),
      local({ id: 'stale', dirty: 0 }),
    ])
    api.list.mockResolvedValue([served({ id: 'mine', name: 'Theirs' })])

    await pullImportTemplates()

    expect((await db.importTemplates.get('mine'))?.name).toBe('Mine')
    expect(await db.importTemplates.get('stale')).toBeUndefined()
  })
})

describe('saveTemplateForImport', () => {
  const session = { signature: SIGNATURE, config, usedTemplateId: null }

  it('writes nothing at all for a one-time mapping', async () => {
    const outcome = await saveTemplateForImport({ mode: 'none' }, session)

    expect(outcome).toEqual({ kind: 'none' })
    expect(await db.importTemplates.count()).toBe(0)
    expect(await outbox()).toHaveLength(0)
  })

  it('bumps the template an import was mapped with, even when nothing is saved', async () => {
    await db.importTemplates.put(local({ dirty: 0, useCount: 2 }))

    const outcome = await saveTemplateForImport(
      { mode: 'none' },
      { ...session, usedTemplateId: 't1' },
    )

    expect(outcome).toEqual({ kind: 'none' })
    expect((await db.importTemplates.get('t1'))?.useCount).toBe(3)
  })

  it('updates the mapping in place, bumping the counters once', async () => {
    await db.importTemplates.put(local({ dirty: 0, useCount: 2 }))
    const next = configFromDraft({ ...draft, amountUnit: 'minor' })

    const outcome = await saveTemplateForImport(
      { mode: 'update', id: 't1' },
      { signature: 'csv1:newsig', config: next, usedTemplateId: 't1' },
    )

    expect(outcome).toEqual({ kind: 'updated', name: 'Al Rajhi' })
    const row = await db.importTemplates.get('t1')
    expect(row?.config?.amountUnit).toBe('minor')
    expect(row?.signature).toBe('csv1:newsig')
    expect(row?.useCount).toBe(3)
    expect(await outbox()).toHaveLength(1)
  })

  it('saves a second template for the same file layout when asked', async () => {
    await db.importTemplates.put(local({ dirty: 0 }))

    const outcome = await saveTemplateForImport(
      { mode: 'new', name: 'Al Rajhi — cards' },
      { ...session, usedTemplateId: 't1' },
    )

    expect(outcome).toEqual({ kind: 'saved', name: 'Al Rajhi — cards' })
    const rows = await db.importTemplates.toArray()
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.signature === SIGNATURE)).toHaveLength(2)
    // The one it was mapped with still records the use.
    expect((await db.importTemplates.get('t1'))?.useCount).toBe(1)
  })
})
