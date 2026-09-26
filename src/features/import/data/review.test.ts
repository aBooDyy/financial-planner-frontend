import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { buildRow } from './csv/rows'
import { countStatuses, isCommittable, reviewOrder, statusOf } from './review'
import type { ParsedRow } from './types'

const mapping = testMapping()
const context = testContext()

const row = (cells: string[], over: Partial<ParsedRow> = {}): ParsedRow => ({
  ...buildRow(cells, 0, mapping, context),
  ...over,
})

const ok = () => row(['2026-06-16', 'Bakery', '-12.40'], { issues: [] })
const warning = () => row(['2026-06-16', 'Bakery', '-12.40'])
const error = () => row(['2026-06-16', 'Bakery', 'N/A'])
const leftOut = () =>
  row(['2026-06-16', 'Bakery', '-12.40'], { issues: [], excluded: true })

describe('statusOf', () => {
  it('reads a row the way a person checks it', () => {
    expect(statusOf(ok())).toBe('ok')
    expect(statusOf(warning())).toBe('warning')
    expect(statusOf(error())).toBe('error')
  })
})

describe('countStatuses', () => {
  it('adds up to the total', () => {
    const counts = countStatuses([ok(), warning(), error(), ok()])
    expect(counts).toEqual({
      total: 4,
      ok: 2,
      warning: 1,
      error: 1,
    })
  })
})

describe('reviewOrder', () => {
  it('opens on what needs attention, then keeps the file’s order', () => {
    const rows = [ok(), warning(), error(), ok()]
    expect(reviewOrder(rows)).toEqual([2, 1, 0, 3])
  })
})

describe('isCommittable', () => {
  it('counts a row that can be read and has not been left out', () => {
    expect(isCommittable(ok())).toBe(true)
    expect(isCommittable(error())).toBe(false)
    expect(isCommittable(leftOut())).toBe(false)
    expect(isCommittable({ ...leftOut(), excluded: false })).toBe(true)
  })
})
