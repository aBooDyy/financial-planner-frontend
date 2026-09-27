import { describe, expect, it } from 'vitest'
import type { LearnOptions } from '#/features/email-sync/api/types'
import {
  describeLabel,
  foundLabel,
  labelCandidates,
  labelLineMarks,
  labelPosition,
} from './labels'

const FROM_EMAIL: LearnOptions = {
  decimal: 'auto',
  currency: { mode: 'from_email', code: null },
}

const LINES = [
  'DATE AND TIME',
  '2026-08-08 23:26',
  'التاريخ والوقت',
  'Amount',
  '10   ( SAR )',
  'مبلغ وقدره',
  '',
  'Merchant name',
  'MUGHASIL',
]

describe('label positions', () => {
  it('says where the label sits from its value', () => {
    expect(labelPosition(0)).toBe('same line')
    expect(labelPosition(1)).toBe('line above')
    expect(labelPosition(-1)).toBe('line below')
    expect(labelPosition(2)).toBe('2 lines above')
    expect(labelPosition(-2)).toBe('2 lines below')
  })

  it('reads a keyword-only label as no label at all', () => {
    expect(
      foundLabel({
        line: null,
        text: null,
        offset: null,
        source: 'keywords',
        verified: true,
      }),
    ).toBeNull()
    expect(
      foundLabel({
        line: 3,
        text: 'Amount',
        offset: 1,
        source: 'nearby',
        verified: true,
      }),
    ).toEqual({ text: 'Amount', position: 'line above' })
  })

  it('describes a template label for a rule row', () => {
    expect(describeLabel(null)).toBe('by keywords')
    expect(describeLabel({ text: 'amount', offset: 0 })).toBe('after “amount”')
    expect(describeLabel({ text: 'amount', offset: 1 })).toBe('below “amount”')
    expect(describeLabel({ text: 'total', offset: -3 })).toBe(
      '3 lines above “total”',
    )
  })
})

describe('labelCandidates', () => {
  it('offers the worded lines within three of the value, in any script', () => {
    const got = labelCandidates(LINES, { line: 4, start: 0, end: 2 }, 'amount')
    expect([...got].sort()).toEqual([2, 3, 5, 7])
  })

  it('offers the value’s own line only when words come before the value', () => {
    expect(
      labelCandidates(['Amount: SAR 38.50'], { line: 0 }, 'amount').has(0),
    ).toBe(true)
    expect(
      labelCandidates(['SAR 38.50'], { line: 0, start: 4, end: 9 }, 'amount')
        .size,
    ).toBe(0)
    expect(labelCandidates(['At: Jarir'], { line: 0 }, 'merchant').has(0)).toBe(
      true,
    )
    expect(labelCandidates(['MUGHASIL'], { line: 0 }, 'merchant').size).toBe(0)
  })
})

describe('labelLineMarks', () => {
  it('marks the user’s label line first, else the learned one, never the value line', () => {
    const marks = labelLineMarks(
      {
        amount: { line: 4, labelLine: 5 },
        currency: { line: 4 },
        merchant: { line: 8 },
      },
      FROM_EMAIL,
      {
        amount: {
          line: 3,
          text: 'Amount',
          offset: 1,
          source: 'nearby',
          verified: true,
        },
        currency: {
          line: 3,
          text: 'Amount',
          offset: 1,
          source: 'nearby',
          verified: true,
        },
        merchant: {
          line: 8,
          text: 'MUGHASIL',
          offset: 0,
          source: 'same_line',
          verified: false,
        },
      },
    )
    expect([...marks.entries()]).toEqual([
      [5, ['amount']],
      [3, ['currency']],
    ])
  })

  it('marks nothing for a fixed currency', () => {
    const marks = labelLineMarks(
      { amount: null, currency: { line: 4, labelLine: 3 }, merchant: null },
      { decimal: 'auto', currency: { mode: 'fixed', code: 'SAR' } },
      null,
    )
    expect(marks.size).toBe(0)
  })
})
