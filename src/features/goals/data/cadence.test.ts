import { describe, expect, it } from 'vitest'
import { FREQUENCIES } from '#/features/goals/constants'
import {
  customFrequencyMeta,
  frequencyMetaOf,
  isValidInterval,
  repeatBlock,
  repeatDraftOf,
  repeatOfDraft,
} from './cadence'

describe('frequencyMetaOf', () => {
  it('reads a preset from the table', () => {
    const meta = frequencyMetaOf({
      frequency: 'quarterly',
      customInterval: null,
      customUnit: null,
    })
    expect(meta).toBe(FREQUENCIES.quarterly)
  })

  it('builds a custom repeat from its interval', () => {
    const meta = frequencyMetaOf({
      frequency: 'custom',
      customInterval: 28,
      customUnit: 'day',
    })
    expect(meta.label).toBe('Every 28 days')
    expect(meta.every).toBe('every 28 days')
    expect(meta.short).toBe('/28d')
    expect(meta.perYear).toBeCloseTo(365 / 28)
  })

  it('falls back when a custom repeat lost its interval', () => {
    const meta = frequencyMetaOf(
      { frequency: 'custom', customInterval: null, customUnit: null },
      'monthly',
    )
    expect(meta).toBe(FREQUENCIES.monthly)
  })
})

describe('customFrequencyMeta', () => {
  it('names a single unit without a count', () => {
    expect(customFrequencyMeta(1, 'week').label).toBe('Every week')
    expect(customFrequencyMeta(1, 'week').short).toBe('/wk')
  })
})

describe('isValidInterval', () => {
  it('accepts 1 to 365 whole units', () => {
    expect(isValidInterval(1)).toBe(true)
    expect(isValidInterval(365)).toBe(true)
    expect(isValidInterval(0)).toBe(false)
    expect(isValidInterval(366)).toBe(false)
    expect(isValidInterval(2.5)).toBe(false)
  })
})

describe('repeat drafts', () => {
  it('holds a preset with the custom field at its defaults', () => {
    const draft = repeatDraftOf(
      { frequency: 'weekly', customInterval: null, customUnit: null },
      'monthly',
    )
    expect(draft).toEqual({
      frequency: 'weekly',
      customRepeat: false,
      customInterval: '28',
      customUnit: 'day',
    })
    expect(repeatOfDraft(draft)).toEqual({
      frequency: 'weekly',
      customInterval: null,
      customUnit: null,
    })
  })

  it('falls back when the stored frequency is missing', () => {
    const draft = repeatDraftOf(
      { frequency: null, customInterval: null, customUnit: null },
      'annual',
    )
    expect(draft.frequency).toBe('annual')
  })

  it('round-trips a custom repeat through the draft', () => {
    const stored = {
      frequency: 'custom' as const,
      customInterval: 3,
      customUnit: 'month' as const,
    }
    const draft = repeatDraftOf(stored, 'monthly')
    expect(draft.customRepeat).toBe(true)
    expect(draft.customInterval).toBe('3')
    expect(repeatOfDraft(draft)).toEqual(stored)
  })

  it('blocks only a custom repeat whose interval is out of range', () => {
    expect(repeatBlock({ customRepeat: false, customInterval: '' })).toBeNull()
    expect(repeatBlock({ customRepeat: true, customInterval: '28' })).toBeNull()
    expect(repeatBlock({ customRepeat: true, customInterval: '0' })).toMatch(
      /1 to 365/,
    )
    expect(
      repeatBlock({ customRepeat: true, customInterval: '' }),
    ).not.toBeNull()
  })
})
