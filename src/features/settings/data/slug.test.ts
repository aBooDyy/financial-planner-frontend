import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

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
