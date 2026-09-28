import { describe, expect, it } from 'vitest'
import { amountTexts, matchesQuery, normalizeQuery, searchText } from './match'

describe('match', () => {
  it('writes an amount plain and grouped at its currency precision', () => {
    expect(amountTexts(245_000, 'EUR')).toEqual(['2450.00', '2,450.00'])
    expect(amountTexts(-500, 'JPY')).toEqual(['500', '500'])
  })

  it('never matches across two fields', () => {
    const text = searchText(['Main', null, 'Cafés'])
    expect(matchesQuery(text, normalizeQuery(' CAF '))).toBe(true)
    expect(matchesQuery(text, normalizeQuery('maincaf'))).toBe(false)
    expect(matchesQuery(text, '')).toBe(true)
  })
})
