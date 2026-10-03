import { describe, expect, it } from 'vitest'
import { bill, planned } from '#/features/planned/testing/fixtures'
import {
  billOccurrences,
  paymentRowsOf,
} from '#/features/planning/data/occurrences'
import {
  ENDS_COUNT_ERROR,
  billBlock,
  billFormOf,
  billWriteOf,
  endsOnOf,
  lastOneLine,
  newBillForm,
  withEnds,
} from './billDraft'
import type { BillForm } from './billDraft'
import { DEFAULT_REPEAT } from './repeat'
import type { RepeatDraft } from './repeat'

const NONE = new Map()

const repeat = (over: Partial<RepeatDraft>): RepeatDraft => ({
  ...DEFAULT_REPEAT,
  ...over,
})

const afterTimes = (
  count: number,
  nextDue: string,
  over: Partial<BillForm> = {},
): BillForm =>
  newBillForm({
    name: 'Rent',
    amount: '100',
    categoryId: 'c1',
    nextDue,
    ends: 'count',
    endsCount: String(count),
    ...over,
  })

describe('a bill that ends after N times', () => {
  it('ends on the Nth monthly occurrence, next due being the first', () => {
    expect(endsOnOf(afterTimes(12, '2026-03-01'), NONE)).toBe('2027-02-01')
    expect(endsOnOf(afterTimes(1, '2026-03-01'), NONE)).toBe('2026-03-01')
  })

  it('steps weekly', () => {
    const form = afterTimes(4, '2026-10-05', {
      repeat: repeat({ pick: 'weekly' }),
    })
    expect(endsOnOf(form, NONE)).toBe('2026-10-26')
  })

  it('steps a custom interval in its unit', () => {
    const days = afterTimes(3, '2026-10-01', {
      repeat: repeat({ pick: 'custom', every: '28', unit: 'day' }),
    })
    expect(endsOnOf(days, NONE)).toBe('2026-11-26')
    const months = afterTimes(3, '2026-01-31', {
      repeat: repeat({ pick: 'custom', every: '2', unit: 'month' }),
    })
    expect(endsOnOf(months, NONE)).toBe('2026-05-31')
  })

  it('keeps a month-end bill on its day, clamped in short months', () => {
    expect(endsOnOf(afterTimes(2, '2026-01-31'), NONE)).toBe('2026-02-28')
    expect(endsOnOf(afterTimes(3, '2026-01-31'), NONE)).toBe('2026-03-31')
  })

  it('reads the clamped day back from the bill’s payments', () => {
    const rows = paymentRowsOf('eom', [
      planned({
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'eom',
        occurrence: '2027-01-31',
        status: 'done',
      }),
    ])
    const form = afterTimes(3, '2027-02-28')
    const endsOn = endsOnOf(form, rows)
    expect(endsOn).toBe('2027-04-30')
    const saved = bill({ id: 'eom', nextDue: '2027-02-28', endsOn })
    expect(billOccurrences(saved, rows, '2027-12-31')).toHaveLength(3)
  })

  it('writes the worked-out date as the bill’s end', () => {
    const form = afterTimes(12, '2026-03-01')
    expect(billWriteOf(form, 'SAR', NONE).endsOn).toBe('2027-02-01')
    expect(lastOneLine(form, NONE)).toBe('Last one on Feb 1, 2027')
  })

  it('blocks a count out of range and has no last one while it is', () => {
    for (const count of ['', '0', '1000']) {
      const form = afterTimes(12, '2026-03-01', { endsCount: count })
      expect(billBlock(form, 'SAR')).toBe(ENDS_COUNT_ERROR)
      expect(lastOneLine(form, NONE)).toBeNull()
    }
  })

  it('ignores the count on a one-off', () => {
    const form = afterTimes(12, '2026-03-01', {
      repeat: repeat({ pick: 'once' }),
    })
    expect(billBlock(form, 'SAR')).toBeNull()
    expect(billWriteOf(form, 'SAR', NONE).endsOn).toBeNull()
  })
})

describe('the bill editor’s Ends pick', () => {
  it('re-opens a stored end as On a date', () => {
    expect(billFormOf(bill({ endsOn: '2027-02-01' })).ends).toBe('date')
    expect(billFormOf(bill({ endsOn: null })).ends).toBe('never')
  })

  it('starts On a date from where After N times would end', () => {
    const form = withEnds(afterTimes(12, '2026-03-01'), 'date', NONE)
    expect(form.ends).toBe('date')
    expect(form.endsOn).toBe('2027-02-01')
  })

  it('starts On a date from next due when it never ended', () => {
    const never = afterTimes(12, '2026-03-01', { ends: 'never' })
    expect(withEnds(never, 'date', NONE).endsOn).toBe('2026-03-01')
  })

  it('writes no end for Never, whatever date it held', () => {
    const form = afterTimes(12, '2026-03-01', {
      ends: 'never',
      endsOn: '2026-12-01',
    })
    expect(billWriteOf(form, 'SAR', NONE).endsOn).toBeNull()
  })

  it('blocks an end date before next due', () => {
    const form = afterTimes(12, '2026-03-01', {
      ends: 'date',
      endsOn: '2026-02-01',
    })
    expect(billBlock(form, 'SAR')).toBe('It can’t end before it is next due')
  })
})
