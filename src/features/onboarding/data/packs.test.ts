import { describe, expect, it } from 'vitest'
import { buildCatalog } from '#/features/categories/data/catalog'
import {
  PACKS,
  REQUIRED_SLUGS,
  isCustomized,
  packSelection,
  suggestedPackId,
  toggleSlug,
} from './packs'

describe('suggestedPackId', () => {
  it('falls back to essentials with no goals', () => {
    expect(suggestedPackId([])).toBe('essentials')
  })

  it('prefers the most specific pack among the goals picked', () => {
    expect(suggestedPackId(['track', 'freelance'])).toBe('freelancer')
    expect(suggestedPackId(['travel', 'household'])).toBe('family')
    expect(suggestedPackId(['save', 'track'])).toBe('saver')
  })
})

describe('packSelection', () => {
  it('always carries the required categories', () => {
    for (const pack of PACKS) {
      expect(packSelection(pack.id)).toEqual(
        expect.arrayContaining([...REQUIRED_SLUGS]),
      )
    }
  })

  it('lists only root categories the built-in set has', () => {
    const roots = new Set(buildCatalog([]).all.map((c) => c.slug))
    for (const pack of PACKS) {
      for (const slug of packSelection(pack.id)) expect(roots).toContain(slug)
    }
  })

  it('offers every built-in root in at least one pack', () => {
    const offered = new Set(PACKS.flatMap((p) => packSelection(p.id)))
    for (const c of buildCatalog([]).all) expect(offered).toContain(c.slug)
  })

  it('never repeats a slug', () => {
    for (const pack of PACKS) {
      const slugs = packSelection(pack.id)
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })
})

describe('toggleSlug', () => {
  it('adds and removes an ordinary category', () => {
    const base = packSelection('student')
    const added = toggleSlug(base, 'travel')
    expect(added).toContain('travel')
    expect(toggleSlug(added, 'travel')).toEqual(base)
  })

  it('leaves a required category in place', () => {
    const base = packSelection('student')
    expect(toggleSlug(base, 'savings')).toEqual(base)
  })
})

describe('isCustomized', () => {
  it('is false for the pack as-is, in any order', () => {
    const reversed = [...packSelection('traveler')].reverse()
    expect(isCustomized(reversed, 'traveler')).toBe(false)
  })

  it('is true once a category is added or removed', () => {
    const base = packSelection('traveler')
    expect(isCustomized(toggleSlug(base, 'gift'), 'traveler')).toBe(true)
    expect(isCustomized(toggleSlug(base, 'dining'), 'traveler')).toBe(true)
  })
})
