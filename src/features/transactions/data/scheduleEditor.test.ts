import { describe, expect, it } from 'vitest'
import { defaultEndDate, recurringEndBlock } from './scheduleEditor'

describe('recurring end date', () => {
  it('starts a year after the next occurrence', () => {
    expect(defaultEndDate('2026-10-05')).toBe('2027-10-05')
  })

  it('blocks only an end before the next due date', () => {
    expect(recurringEndBlock('2026-10-05', null)).toBeNull()
    expect(recurringEndBlock('2026-10-05', '2026-10-05')).toBeNull()
    expect(recurringEndBlock('2026-10-05', '2026-10-04')).toBe(
      'End date is before the next due date',
    )
  })
})
