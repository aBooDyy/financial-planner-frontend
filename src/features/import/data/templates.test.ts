import { describe, expect, it } from 'vitest'
import { testDialect } from './__fixtures__/mapping'
import {
  applyTemplateConfig,
  categoryKeyOf,
  configFromDraft,
  needsReread,
  rankTemplates,
  signatureOf,
  suggestTemplateName,
  templateHint,
} from './templates'
import { DEFAULT_DEDUPE, TEMPLATE_CONFIG_VERSION, emptyAliases } from './types'
import type { LocalImportTemplate } from '#/db/types'
import type { MappingDraft } from './mapping'
import type { TemplateCatalogue } from './templates'

const HEADERS = ['Date', 'Description', 'Debit', 'Credit', 'Currency']

const catalogue = (
  overrides: Partial<TemplateCatalogue> = {},
): TemplateCatalogue => ({
  walletIds: new Set(['w1']),
  categoryKeys: new Set([categoryKeyOf('groceries', null)]),
  merchantIds: new Set(['m1']),
  ...overrides,
})

const draft = (overrides: Partial<MappingDraft> = {}): MappingDraft => ({
  dialect: testDialect(),
  dateFormat: 'DD/MM/YYYY',
  dateAmbiguous: false,
  roles: ['date', 'merchant', 'amountOut', 'amountIn', 'currency'],
  amountKind: 'split',
  negativeMeans: 'spend',
  amountUnit: 'major',
  defaults: {
    walletId: 'w1',
    currency: 'SAR',
    type: 'spend',
    category: 'other',
    subcategory: null,
  },
  aliases: emptyAliases(),
  dedupe: DEFAULT_DEDUPE,
  ...overrides,
})

describe('signatureOf', () => {
  const base = signatureOf(HEADERS, ',')

  it('is short, non-blank and within the server cap', () => {
    expect(base.length).toBeGreaterThan(0)
    expect(base.length).toBeLessThanOrEqual(64)
    expect(base.trim()).toBe(base)
  })

  it('survives the things that legitimately vary between two exports', () => {
    // Case, padding, punctuation, a BOM and diacritics all move within one bank's exports.
    expect(
      signatureOf(
        ['﻿  DATE ', 'Description:', 'DEBIT', 'crédit', 'Currency'],
        ',',
      ),
    ).toBe(base)
  })

  it('ignores a nameless trailing column from a trailing delimiter', () => {
    expect(signatureOf([...HEADERS, '', '   '], ',')).toBe(base)
  })

  it('moves when the columns change', () => {
    expect(
      signatureOf(['Date', 'Description', 'Debit', 'Credit'], ','),
    ).not.toBe(base)
    expect(signatureOf([...HEADERS, 'Balance'], ',')).not.toBe(base)
  })

  it('moves when the same columns are in a different order', () => {
    expect(
      signatureOf(['Description', 'Date', 'Debit', 'Credit', 'Currency'], ','),
    ).not.toBe(base)
  })

  it('moves with the delimiter that produced the headers', () => {
    expect(signatureOf(HEADERS, ';')).not.toBe(base)
  })

  it('is stable across calls — the whole point of saving it', () => {
    expect(signatureOf(HEADERS, ',')).toBe(base)
  })
})

describe('configFromDraft / applyTemplateConfig', () => {
  it('round-trips a mapping unchanged', () => {
    const original = draft({
      aliases: {
        ...emptyAliases(),
        wallets: { current: { kind: 'wallet', walletId: 'w1' } },
        categories: {
          supermarket: {
            kind: 'category',
            category: 'groceries',
            subcategory: null,
          },
        },
        merchants: { carrefour: { kind: 'merchant', merchantId: 'm1' } },
        types: { dr: 'spend' },
        currencies: { sr: 'SAR' },
      },
    })
    const config = configFromDraft(original)
    expect(config.version).toBe(TEMPLATE_CONFIG_VERSION)

    const applied = applyTemplateConfig(config, 5, catalogue())
    expect(applied.unknown).toEqual([])
    expect(applied.draft).toEqual(original)
  })

  it('survives the JSON trip the wire makes it take', () => {
    const config = configFromDraft(draft())
    const parsed = JSON.parse(JSON.stringify(config)) as typeof config
    expect(applyTemplateConfig(parsed, 5, catalogue()).draft).toEqual(draft())
  })

  it('stores a "create" answer as the binding it became', () => {
    const config = configFromDraft(
      draft({
        aliases: {
          ...emptyAliases(),
          wallets: {
            savings: {
              kind: 'create',
              walletId: 'w9',
              name: 'Savings',
              currency: 'SAR',
            },
          },
          merchants: {
            bakery: { kind: 'create', merchantId: 'm9', displayName: 'Bakery' },
          },
        },
      }),
    )
    expect(config.aliases.wallets.savings).toEqual({
      kind: 'wallet',
      walletId: 'w9',
    })
    expect(config.aliases.merchants.bakery).toEqual({
      kind: 'merchant',
      merchantId: 'm9',
    })
  })

  it('drops answers whose target is gone, and says so', () => {
    const config = configFromDraft(
      draft({
        aliases: {
          ...emptyAliases(),
          wallets: {
            current: { kind: 'wallet', walletId: 'w1' },
            closed: { kind: 'wallet', walletId: 'deleted-wallet' },
          },
          categories: {
            fuel: { kind: 'category', category: 'gone', subcategory: null },
          },
          merchants: {
            carrefour: { kind: 'merchant', merchantId: 'm1' },
            merged: { kind: 'merchant', merchantId: 'merged-away' },
          },
        },
      }),
    )
    const applied = applyTemplateConfig(config, 5, catalogue())

    expect(Object.keys(applied.draft.aliases.wallets)).toEqual(['current'])
    expect(applied.draft.aliases.categories).toEqual({})
    expect(Object.keys(applied.draft.aliases.merchants)).toEqual(['carrefour'])
    expect(applied.unknown.map((u) => [u.kind, u.key])).toEqual([
      ['wallet', 'closed'],
      ['category', 'fuel'],
      ['merchant', 'merged'],
    ])
    expect(applied.unknown[0].message).toContain('closed')
  })

  it('keeps a "skip" answer, which targets nothing that can disappear', () => {
    const config = configFromDraft(
      draft({
        aliases: { ...emptyAliases(), merchants: { atm: { kind: 'skip' } } },
      }),
    )
    const applied = applyTemplateConfig(config, 5, catalogue())
    expect(applied.draft.aliases.merchants.atm).toEqual({ kind: 'skip' })
    expect(applied.unknown).toEqual([])
  })

  it('reports a default account that no longer exists rather than filing into it', () => {
    const config = configFromDraft(draft())
    const applied = applyTemplateConfig(
      config,
      5,
      catalogue({ walletIds: new Set<string>() }),
    )
    expect(applied.draft.defaults.walletId).toBeNull()
    expect(applied.unknown.map((u) => u.kind)).toEqual(['default'])
  })

  it('fits a saved role list to the file that is open', () => {
    const config = configFromDraft(draft())
    expect(applyTemplateConfig(config, 3, catalogue()).draft.roles).toEqual([
      'date',
      'merchant',
      'amountOut',
    ])
    expect(applyTemplateConfig(config, 7, catalogue()).draft.roles).toEqual([
      'date',
      'merchant',
      'amountOut',
      'amountIn',
      'currency',
      'skip',
      'skip',
    ])
  })

  it('treats the saved date format as the answer to an ambiguous column', () => {
    const config = configFromDraft(draft({ dateAmbiguous: true }))
    const applied = applyTemplateConfig(config, 5, catalogue())
    expect(applied.draft.dateFormat).toBe('DD/MM/YYYY')
    expect(applied.draft.dateAmbiguous).toBe(false)
  })
})

describe('needsReread', () => {
  it('is true only for the fields that decide how the file is parsed', () => {
    const saved = testDialect()
    expect(needsReread(saved, testDialect({ decimal: ',' }))).toBe(false)
    expect(needsReread(saved, testDialect({ delimiter: ';' }))).toBe(true)
    expect(needsReread(saved, testDialect({ skipRows: 4 }))).toBe(true)
    expect(needsReread(saved, testDialect({ encoding: 'windows-1256' }))).toBe(
      true,
    )
  })
})

const template = (
  overrides: Partial<LocalImportTemplate> = {},
): LocalImportTemplate => ({
  id: 't1',
  name: 'Al Rajhi',
  sourceKind: 'csv',
  signature: 'csv1:aaaaaaaa',
  config: configFromDraft(draft()),
  lastUsedAt: '2026-09-01T00:00:00Z',
  useCount: 3,
  nameConflict: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...overrides,
})

describe('rankTemplates', () => {
  it('puts the signature match first, then the most recently used', () => {
    const rows = [
      template({ id: 'old', lastUsedAt: '2026-01-01T00:00:00Z' }),
      template({ id: 'recent', lastUsedAt: '2026-09-10T00:00:00Z' }),
      template({ id: 'match', signature: 'csv1:bbbbbbbb' }),
    ]
    expect(rankTemplates(rows, 'csv1:bbbbbbbb').map((t) => t.id)).toEqual([
      'match',
      'recent',
      'old',
    ])
  })
})

describe('templateHint', () => {
  it('names the state that keeps a template from being used', () => {
    expect(templateHint(template({ config: null }))).toBe('needs rebuilding')
    expect(templateHint(template({ nameConflict: 1 }))).toBe('rename to sync')
    expect(templateHint(template({ useCount: 0 }))).toBe('not used yet')
    expect(templateHint(template({ lastUsedAt: null }))).toBe('used 3 times')
  })

  it('says how long ago the mapping last worked', () => {
    expect(templateHint(template())).toMatch(/^used 3 times · last /)
  })
})

describe('suggestTemplateName', () => {
  it('drops the extension and the period, which next month will not share', () => {
    expect(suggestTemplateName('alrajhi-2026-08.csv')).toBe('Alrajhi')
    expect(suggestTemplateName('wise_statement.csv')).toBe('Wise statement')
    expect(suggestTemplateName('2026-08.csv')).toBe('My import')
  })
})
