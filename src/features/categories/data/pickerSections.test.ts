import { describe, expect, it } from 'vitest'
import { buildCatalog } from './catalog'
import { pickerSections, pickerValue } from './pickerSections'

const spend = buildCatalog([]).byType('spend')

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

describe('pickerValue', () => {
  it('is the slug for a parent and slug/sub for a child', () => {
    expect(pickerValue('dining', null)).toBe('dining')
    expect(pickerValue('dining', 'cafes')).toBe('dining/cafes')
  })
})
