import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('lowercases and underscores spaces', () => {
    expect(slugify('Pet Care')).toBe('pet_care')
  })

  it('collapses runs of non-alphanumerics and trims edges', () => {
    expect(slugify('  Health & Fitness!! ')).toBe('health_fitness')
  })

  it('keeps digits', () => {
    expect(slugify('Side hustle 2')).toBe('side_hustle_2')
  })

  it('falls back to "category" when nothing usable remains', () => {
    expect(slugify('   ')).toBe('category')
    expect(slugify('!!!')).toBe('category')
  })
})

describe('uniqueSlug', () => {
  it('keeps the plain slug when no sibling has it', () => {
    expect(uniqueSlug('Pet Care', ['dining'])).toBe('pet_care')
  })

  it('suffixes past every taken sibling slug', () => {
    expect(uniqueSlug('Pet Care', ['pet_care', 'pet_care_2'])).toBe(
      'pet_care_3',
    )
  })

  it('accepts any iterable of taken slugs', () => {
    expect(uniqueSlug('Fuel', new Set(['fuel']))).toBe('fuel_2')
  })
})
