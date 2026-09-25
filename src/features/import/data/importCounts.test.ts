import { describe, expect, it } from 'vitest'
import { batchPlan, planLabel, planPhrase } from './importCounts'

describe('import counts', () => {
  it('counts transfers apart from transactions, and only when there are some', () => {
    expect(planLabel({ transactions: 1, transfers: 0 })).toBe('1 transaction')
    expect(planLabel({ transactions: 1200, transfers: 1 })).toBe(
      '1,200 transactions · 1 transfer',
    )
    expect(planPhrase({ transactions: 2, transfers: 3 })).toBe(
      '2 transactions and 3 transfers',
    )
  })

  it('reads a batch from before transfers could be imported as holding none', () => {
    expect(batchPlan({ importedCount: 4 })).toEqual({
      transactions: 4,
      transfers: 0,
    })
  })
})
