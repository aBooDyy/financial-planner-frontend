import { describe, expect, it } from 'vitest'
import { parseReportsSearch } from './search'

describe('parseReportsSearch', () => {
  it('keeps valid controls', () => {
    expect(
      parseReportsSearch({ range: 'ytd', compare: 'yoy', accounts: 'w:w1' }),
    ).toEqual({ range: 'ytd', compare: 'yoy', accounts: 'w:w1' })
  })

  it('drops unknown presets and comparisons, and an empty account filter', () => {
    expect(
      parseReportsSearch({ range: 'last_2', compare: 'later', accounts: '' }),
    ).toEqual({})
    expect(
      parseReportsSearch({ range: 7, compare: null, accounts: 3 }),
    ).toEqual({})
  })

  it('keeps a custom range only with both ends valid', () => {
    expect(
      parseReportsSearch({
        range: 'custom',
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ).toEqual({ range: 'custom', from: '2026-06-01', to: '2026-06-30' })
    expect(parseReportsSearch({ range: 'custom', from: '2026-06-01' })).toEqual(
      {},
    )
    expect(
      parseReportsSearch({ range: 'custom', from: '2026-06-01', to: 'June' }),
    ).toEqual({})
  })

  it('ignores custom ends on a preset', () => {
    expect(
      parseReportsSearch({
        range: 'last_3',
        from: '2026-06-01',
        to: '2026-06-30',
      }),
    ).toEqual({ range: 'last_3' })
  })
})
