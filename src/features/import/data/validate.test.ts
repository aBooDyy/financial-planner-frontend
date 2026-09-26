import { describe, expect, it } from 'vitest'
import { testContext, testFacts, testMapping } from './__fixtures__/mapping'
import { ROW_ISSUES } from './types'
import { validateRow } from './validate'
import type { RowFacts, RowIssue } from './types'

const check = (
  facts: Partial<RowFacts>,
  mapping = testMapping(),
  context = testContext(),
): RowIssue[] => validateRow(testFacts(facts), mapping, context)

const codes = (issues: ReadonlyArray<RowIssue>): string[] =>
  issues.map((issue) => issue.code)

describe('validateRow', () => {
  it('passes a clean row', () => {
    expect(check({})).toEqual([])
  })

  it('blocks an unreadable date and names the cell', () => {
    const issues = check({ date: null, dateCell: '32/13/2026' })
    expect(issues).toEqual([
      {
        level: 'error',
        field: 'date',
        code: ROW_ISSUES.dateUnreadable,
        detail: '32/13/2026',
      },
    ])
  })

  it('warns on every row of an ambiguous date column', () => {
    const issues = check({}, testMapping({ dateAmbiguous: true }))
    expect(codes(issues)).toEqual([ROW_ISSUES.dateAmbiguous])
    expect(issues[0].level).toBe('warning')
  })

  it('warns on a date beyond tomorrow, and allows tomorrow itself', () => {
    expect(codes(check({ date: '2026-09-01' }))).toEqual([
      ROW_ISSUES.dateImplausible,
    ])
    expect(codes(check({ date: '2026-06-21' }))).toEqual([])
    expect(codes(check({ date: '1969-12-31' }))).toEqual([
      ROW_ISSUES.dateImplausible,
    ])
  })

  it('blocks an unreadable, ambiguous or missing amount', () => {
    expect(
      codes(check({ amountState: 'unreadable', amountCell: 'N/A' })),
    ).toEqual([ROW_ISSUES.amountUnreadable])
    expect(codes(check({ amountState: 'ambiguous' }))).toEqual([
      ROW_ISSUES.amountAmbiguous,
    ])
    expect(codes(check({ amountState: 'missing' }))).toEqual([
      ROW_ISSUES.amountMissing,
    ])
  })

  it('keeps a zero amount, with a warning', () => {
    const issues = check({ amountMinor: 0, amountCell: '0.00' })
    expect(codes(issues)).toEqual([ROW_ISSUES.amountZero])
    expect(issues[0].level).toBe('warning')
  })

  it('blocks an unsupported currency and names the cell', () => {
    const issues = check({
      currency: null,
      currencyCell: 'BTC',
      amountState: 'skipped',
      amountMinor: null,
    })
    expect(issues).toEqual([
      {
        level: 'error',
        field: 'currency',
        code: ROW_ISSUES.currencyUnsupported,
        detail: 'BTC',
      },
    ])
  })

  it('warns when the row currency differs from its wallet', () => {
    const issues = check({ currency: 'USD', currencyCell: 'USD' })
    expect(codes(issues)).toEqual([ROW_ISSUES.currencyMismatch])
    expect(issues[0].level).toBe('warning')
  })

  it('blocks a row with no wallet and no default', () => {
    expect(codes(check({ walletId: null }))).toEqual([
      ROW_ISSUES.walletUnresolved,
    ])
  })

  it('says nothing about a row the wallet mapping asked to skip', () => {
    expect(codes(check({ walletId: null, walletSkipped: true }))).toEqual([])
  })

  it('warns when the category or the direction was guessed', () => {
    expect(codes(check({ categoryDefaulted: true }))).toEqual([
      ROW_ISSUES.categoryDefaulted,
    ])
    expect(codes(check({ typeDefaulted: true }))).toEqual([
      ROW_ISSUES.typeDefaulted,
    ])
  })

  it('blocks a row filed under a category that no longer exists', () => {
    expect(codes(check({ categoryId: 'new-category::fuel' }))).toEqual([
      ROW_ISSUES.categoryMissing,
    ])
    expect(codes(check({ categoryId: '' }))).toEqual([
      ROW_ISSUES.categoryMissing,
    ])
  })

  it('blocks a row filed under a category of the other direction', () => {
    expect(codes(check({ type: 'income' }))).toEqual([
      ROW_ISSUES.categoryTypeMismatch,
    ])
  })

  it('warns about a short row', () => {
    const issues = check({ ragged: true, raw: ['2026-06-16', 'Bakery'] })
    expect(issues).toEqual([
      {
        level: 'warning',
        field: 'row',
        code: ROW_ISSUES.ragged,
        detail: '2',
      },
    ])
  })

  it('reports every problem a row has, in reading order', () => {
    expect(
      codes(
        check({
          date: null,
          amountState: 'missing',
          walletId: null,
          categoryDefaulted: true,
          ragged: true,
        }),
      ),
    ).toEqual([
      ROW_ISSUES.dateUnreadable,
      ROW_ISSUES.amountMissing,
      ROW_ISSUES.walletUnresolved,
      ROW_ISSUES.categoryDefaulted,
      ROW_ISSUES.ragged,
    ])
  })
})
