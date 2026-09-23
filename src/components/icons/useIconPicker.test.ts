import { describe, expect, it } from 'vitest'
import { matchIconIds } from './useIconPicker'
import { ICON_IDS } from '#/lib/icons/catalog.gen'
import { SEARCH } from '#/lib/icons/search.gen'

const match = (query: string) => matchIconIds(SEARCH, query)

describe('matchIconIds', () => {
  it('ranks the icon whose keyword is the query first', () => {
    expect(match('save')[0]).toBe('piggy-bank')
    expect(match('eat')[0]).toBe('fork-knife')
  })

  it('matches on the id itself', () => {
    expect(match('piggy-bank')[0]).toBe('piggy-bank')
  })

  it('returns nothing for a query the pack has no word for', () => {
    expect(match('zzz')).toEqual([])
  })

  it('returns the whole pack for an empty query', () => {
    expect(match('')).toHaveLength(ICON_IDS.length)
    expect(match('   ')).toHaveLength(ICON_IDS.length)
  })
})
