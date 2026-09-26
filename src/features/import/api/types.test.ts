import { describe, expect, it } from 'vitest'
import { testDialect } from '#/features/import/data/__fixtures__/mapping'
import { configFromDraft } from '#/features/import/data/templates'
import {
  DEFAULT_DEDUPE,
  emptyAliases,
  isConfigV1,
} from '#/features/import/data/types'
import type { MappingDraft } from '#/features/import/data/mapping'
import { parseTemplateConfig } from './types'

const draft: MappingDraft = {
  dialect: testDialect(),
  dateFormat: 'YYYY-MM-DD',
  dateAmbiguous: false,
  roles: ['date', 'merchant', 'amount'],
  amountKind: 'signed',
  negativeMeans: 'spend',
  amountUnit: 'major',
  defaults: {
    walletId: null,
    currency: 'SAR',
    type: 'spend',
    categoryIds: { spend: 'cat-other', income: 'cat-other_income' },
  },
  aliases: emptyAliases(),
  dedupe: DEFAULT_DEDUPE,
}

const v2 = () => configFromDraft(draft)

describe('parseTemplateConfig', () => {
  it('reads a version-2 config', () => {
    const parsed = parseTemplateConfig(JSON.stringify(v2()))
    expect(parsed).toEqual(v2())
    expect(parsed && isConfigV1(parsed)).toBe(false)
  })

  it('reads a version-1 config, for the upgrade to turn into ids', () => {
    const { categoryIds: _ids, ...defaults } = v2().defaults
    const v1 = {
      ...v2(),
      version: 1,
      defaults: { ...defaults, category: 'other', subcategory: null },
    }
    const parsed = parseTemplateConfig(JSON.stringify(v1))
    expect(parsed && isConfigV1(parsed)).toBe(true)
  })

  it('refuses a version-2 config without its default categories', () => {
    const { categoryIds: _ids, ...defaults } = v2().defaults
    expect(
      parseTemplateConfig(JSON.stringify({ ...v2(), defaults })),
    ).toBeNull()
  })

  it('refuses a version-1 config without its default category', () => {
    const { categoryIds: _ids, ...defaults } = v2().defaults
    expect(
      parseTemplateConfig(JSON.stringify({ ...v2(), version: 1, defaults })),
    ).toBeNull()
  })
})
