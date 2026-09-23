import { describe, expect, it } from 'vitest'
import { identityKey } from './matching'
import { MAX_SUGGESTIONS, mergeSuggestions } from './suggestions'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import type { MerchantIndex } from './matching'

const merchant = (
  id: string,
  displayName: string,
  timesSeen = 1,
): LocalMerchant => ({
  id,
  displayName,
  learnedCategory: null,
  learnedSubcategory: null,
  learnedType: null,
  timesSeen,
  timesConfirmed: 0,
  lastSeenAt: null,
  autoCategorize: false,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  version: 'v',
  dirty: 0,
  deleted: 0,
})

const alias = (
  id: string,
  merchantId: string,
  raw: string,
): LocalMerchantAlias => ({
  id,
  merchantId,
  normalizedKey: identityKey(raw),
  rawSample: raw,
  origin: 'import',
  createdAt: '2026-09-01T00:00:00Z',
  version: 'v',
  dirty: 0,
  deleted: 0,
})

const index = (
  merchants: LocalMerchant[],
  aliases: LocalMerchantAlias[] = [],
): MerchantIndex => ({ merchants, aliases })

describe('mergeSuggestions', () => {
  it('finds the branch-code explosion a bulk import leaves behind', () => {
    const found = mergeSuggestions(
      index([
        merchant('m1', 'CARREFOUR HYPER 4471', 12),
        merchant('m2', 'CARREFOUR HYPER 118', 1),
      ]),
    )

    expect(found).toHaveLength(1)
    expect(found[0].source.id).toBe('m2')
    expect(found[0].target.id).toBe('m1')
  })

  it('folds the rarer row into the one seen most often', () => {
    const found = mergeSuggestions(
      index([
        merchant('rare', 'Panda Retail 218', 1),
        merchant('common', 'Panda Retail', 40),
      ]),
    )

    expect(found[0].source.displayName).toBe('Panda Retail 218')
    expect(found[0].target.displayName).toBe('Panda Retail')
  })

  it('never pairs two shops that agree on nothing but a branch number', () => {
    expect(
      mergeSuggestions(
        index([
          merchant('m1', 'Corner Shop 402'),
          merchant('m2', 'Bakery 402'),
        ]),
      ),
    ).toEqual([])
  })

  it('leaves genuinely different merchants alone', () => {
    expect(
      mergeSuggestions(
        index([
          merchant('m1', 'Jarir Bookstore'),
          merchant('m2', 'Saudi Electricity'),
          merchant('m3', 'Dunkin Donuts'),
        ]),
      ),
    ).toEqual([])
  })

  it('scores a stored spelling, not just the display name', () => {
    const found = mergeSuggestions(
      index(
        [merchant('m1', 'STC', 9), merchant('m2', 'Saudi Telecom')],
        [alias('a1', 'm1', 'Saudi Telecom Company')],
      ),
    )

    expect(found).toHaveLength(1)
    expect(found[0].target.id).toBe('m1')
    expect(found[0].targetSpelling).toBe('Saudi Telecom Company')
    expect(found[0].sourceSpelling).toBe('Saudi Telecom')
  })

  it('speaks about each merchant once, so no suggestion chains', () => {
    const found = mergeSuggestions(
      index([
        merchant('m1', 'Tamimi Markets Olaya', 5),
        merchant('m2', 'Tamimi Markets Malaz', 3),
        merchant('m3', 'Tamimi Markets Khobar', 1),
      ]),
    )

    const ids = found.flatMap((s) => [s.source.id, s.target.id])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores deleted merchants', () => {
    const gone = {
      ...merchant('m2', 'CARREFOUR HYPER 118'),
      deleted: 1 as const,
    }
    expect(
      mergeSuggestions(index([merchant('m1', 'CARREFOUR HYPER 4471'), gone])),
    ).toEqual([])
  })

  it('stays a nudge, not a chore', () => {
    const many = Array.from({ length: 40 }, (_unused, i) =>
      merchant(`m${i}`, `Carrefour Market ${i}`, 40 - i),
    )
    expect(mergeSuggestions(index(many)).length).toBe(MAX_SUGGESTIONS)
  })

  it('has nothing to say about a single merchant', () => {
    expect(mergeSuggestions(index([merchant('m1', 'Solo')]))).toEqual([])
  })
})
