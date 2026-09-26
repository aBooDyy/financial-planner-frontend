import { describe, expect, it } from 'vitest'
import { defaultCatalog } from '#/features/categories/__fixtures__/categories'
import { pickerSections } from './pickerSections'

const spend = defaultCatalog().byType('spend')

const outline = (query: string) =>
  pickerSections(spend, query).map(
    (s) => `${s.parent.slug}: ${s.subs.map((sub) => sub.slug).join(',')}`,
  )

describe('pickerSections', () => {
  it('lists every parent with all of its children when there is no query', () => {
    const sections = pickerSections(spend, '  ')
    expect(sections.map((s) => s.parent.slug)).toEqual(spend.map((c) => c.slug))
    expect(sections[1].subs).toEqual(spend[1].subs)
  })

  it('brings every child along when the parent matches', () => {
    expect(outline('dining')[0]).toBe(
      'dining: restaurants,cafes,takeaway,snacks',
    )
  })

  it('keeps only the matching children under a parent that does not match', () => {
    expect(outline('bakery')).toEqual(['groceries: bakery'])
  })

  it('leaves out parents with no match at all', () => {
    expect(outline('zzzz')).toEqual([])
  })
})
