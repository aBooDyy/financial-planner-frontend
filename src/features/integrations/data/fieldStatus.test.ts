// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  catId,
  categoryRow,
  defaultCatalog,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { buildCatalog } from '#/features/categories/data/catalog'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type {
  Extraction,
  ExtractionWire,
} from '#/features/integrations/api/ruleTypes'
import { toExtraction } from '#/features/integrations/api/ruleTypes'
import { aKeyWire } from '#/features/integrations/__fixtures__/keys'
import { settingsOf, toIntegrationKey } from '#/features/integrations/api/types'
import { useFieldStatusContext } from '#/features/integrations/hooks/useFieldStatusContext'
import { statusLine } from './fieldStatus'

const extraction = (resolved: Extraction['resolved']): Extraction => ({
  fields: {
    category: { value: 'Dining', raw: 'Dining', status: 'OK' },
    subcategory: { value: 'Cafés', raw: 'Cafés', status: 'OK' },
  },
  values: {
    date: '2026-09-23',
    type: 'SPEND',
    amount: null,
    currency: null,
    merchant: null,
    category: 'Dining',
    subcategory: 'Cafés',
    note: null,
    externalId: null,
    wallet: null,
  },
  missing: [],
  resolved,
})

const contextFor = (
  found: Extraction,
  catalog: CategoryCatalog = defaultCatalog(),
  defaultCategoryId: string | null = null,
) =>
  renderHook(() =>
    useFieldStatusContext(
      toIntegrationKey(aKeyWire({ default_category_id: defaultCategoryId })),
      new Map(),
      catalog,
      found,
      true,
    ),
  ).result.current

describe('category status lines', () => {
  it('names a resolved child by id: its parent on the category line, itself below', () => {
    const ctx = contextFor(
      extraction({ walletId: null, categoryId: catId('cafes', 'dining') }),
    )
    expect(statusLine('category', true, ctx)).toMatchObject({
      tone: 'ok',
      value: 'Dining',
    })
    expect(statusLine('subcategory', true, ctx)).toMatchObject({
      tone: 'ok',
      value: 'Cafés',
    })
  })

  it('tells two children that share a slug apart by id', () => {
    const rows = [
      ...defaultCategoryRows(),
      categoryRow({
        id: 'car-maint',
        parentId: catId('transport'),
        slug: 'maintenance',
        name: 'Car service',
      }),
      categoryRow({
        id: 'home-maint',
        parentId: catId('housing'),
        slug: 'maintenance',
        name: 'Home repairs',
      }),
    ]
    const ctx = contextFor(
      extraction({ walletId: null, categoryId: 'home-maint' }),
      buildCatalog(rows),
    )
    expect(statusLine('category', true, ctx).value).toBe('Housing')
    expect(statusLine('subcategory', true, ctx).value).toBe('Home repairs')
  })

  it('says a root has no subcategory', () => {
    const ctx = contextFor(
      extraction({ walletId: null, categoryId: catId('dining') }),
    )
    expect(statusLine('category', true, ctx).value).toBe('Dining')
    expect(statusLine('subcategory', true, ctx)).toMatchObject({
      tone: 'idle',
      tail: ' isn’t a subcategory of that category.',
    })
  })

  it('shows a delivery’s logged words as they are, whatever the catalog says now', () => {
    const { externalId: _drop, ...values } = extraction({
      walletId: null,
      categoryId: null,
    }).values
    const wire: ExtractionWire = {
      fields: { category: { value: 'x', raw: 'x', status: 'OK' } },
      values: { ...values, external_id: null },
      missing: [],
      resolved: {
        wallet_id: null,
        category_id: null,
        category: 'groceries',
        subcategory: null,
      },
    }
    const logged = toExtraction(wire)
    const ctx = contextFor(logged)
    expect(statusLine('category', true, ctx).value).toBe('groceries')
  })

  it('names the key’s default category when the field is not set', () => {
    const ctx = contextFor(
      extraction({ walletId: null, categoryId: null }),
      defaultCatalog(),
      catId('cafes', 'dining'),
    )
    expect(statusLine('category', false, ctx)).toMatchObject({
      tone: 'idle',
      value: 'Dining · Cafés',
    })
  })
})

it('keeps the settings a key carries', () => {
  expect(settingsOf(toIntegrationKey(aKeyWire())).defaultCategoryId).toBe(
    'cat-groceries',
  )
})
