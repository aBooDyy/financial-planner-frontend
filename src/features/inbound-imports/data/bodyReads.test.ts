import { describe, expect, it } from 'vitest'
import {
  displayLines,
  displayName,
  fieldForTap,
  firstEmpty,
  lineSegments,
  locateReads,
  tappedText,
} from './bodyReads'

const EMAIL = [
  'Dear customer,',
  'Purchase of SAR 38.50',
  'at STARBUCKS RIYADH',
  'Available balance SAR 12,300.10',
]

const values = (over: Partial<Record<string, string>> = {}) => ({
  amount: '38.50',
  currency: 'SAR',
  merchant: 'STARBUCKS RIYADH',
  ...over,
})

describe('locateReads', () => {
  it('finds each value where it is written, the currency beside the amount', () => {
    const reads = locateReads(EMAIL, values())

    expect(reads.get(1)).toEqual([
      { start: 16, end: 21, field: 'amount' },
      { start: 12, end: 15, field: 'currency' },
    ])
    expect(reads.get(2)).toEqual([{ start: 3, end: 19, field: 'merchant' }])
    expect(reads.has(3)).toBe(false)
  })

  it('matches the amount by its number, not its spelling', () => {
    const reads = locateReads(EMAIL, values({ amount: '12300.1' }))

    expect(reads.get(3)?.find((r) => r.field === 'amount')).toEqual({
      start: 22,
      end: 31,
      field: 'amount',
    })
  })

  it('finds a merchant typed in another case', () => {
    const reads = locateReads(EMAIL, values({ merchant: 'Starbucks Riyadh' }))

    expect(reads.get(2)).toEqual([{ start: 3, end: 19, field: 'merchant' }])
  })

  it('reads nothing for values that are empty or not in the body', () => {
    const reads = locateReads(
      EMAIL,
      values({ amount: '', merchant: 'Jarir', currency: 'USD' }),
    )

    expect(reads.size).toBe(0)
  })
})

describe('lineSegments', () => {
  it('cuts a line into plain text, tappable tokens and what was read', () => {
    const { segments } = lineSegments('Available balance SAR 12,300.10', [])

    expect(
      segments.map((s) =>
        s.kind === 'token' ? `${s.shape}:${s.text}` : s.text,
      ),
    ).toEqual([
      'word:Available',
      ' ',
      'word:balance',
      ' ',
      'currency:SAR',
      ' ',
      'number:12,300.10',
    ])
  })

  it('lets a read span swallow the tokens under it', () => {
    const { segments } = lineSegments('at STARBUCKS RIYADH', [
      { start: 3, end: 19, field: 'merchant' },
    ])

    expect(segments).toEqual([
      { kind: 'token', text: 'at', index: 0, shape: 'word' },
      { kind: 'plain', text: ' ' },
      { kind: 'read', text: 'STARBUCKS RIYADH', field: 'merchant' },
    ])
  })

  it('keeps the rest of a token a read span starts inside', () => {
    const { segments } = lineSegments('Total:SAR38.50!', [
      { start: 9, end: 14, field: 'amount' },
    ])

    expect(segments.map((s) => s.text).join('')).toBe('Total:SAR38.50!')
    expect(segments.find((s) => s.kind === 'read')?.text).toBe('38.50')
  })
})

describe('tapping', () => {
  it('grows a merchant over the name around the tapped word', () => {
    const line = 'Purchase at CARREFOUR HYPER on 24/09'
    const { tokens } = lineSegments(line, [])

    expect(tappedText(line, tokens, 2, 'merchant')).toBe('CARREFOUR HYPER')
    expect(tappedText(line, tokens, 2, 'amount')).toBe('CARREFOUR')
  })

  it('fills a code’s and a number’s own field; words only name a merchant', () => {
    expect(fieldForTap('currency', 'amount')).toBe('currency')
    expect(fieldForTap('number', 'currency')).toBe('amount')
    expect(fieldForTap('number', 'merchant')).toBe('merchant')
    expect(fieldForTap('word', 'amount')).toBeNull()
    expect(fieldForTap('word', 'merchant')).toBe('merchant')
  })

  it('starts on the first field still empty', () => {
    expect(firstEmpty(values({ amount: '' }))).toBe('amount')
    expect(firstEmpty(values({ merchant: ' ' }))).toBe('merchant')
    expect(firstEmpty(values())).toBe('amount')
  })
})

describe('display', () => {
  it('title-cases a shouted name and leaves a cased one alone', () => {
    expect(displayName('STARBUCKS RIYADH')).toBe('Starbucks Riyadh')
    expect(displayName('AL-OTHAIM MARKETS')).toBe('Al-Othaim Markets')
    expect(displayName('McDonald’s')).toBe('McDonald’s')
  })

  it('pretty-prints a JSON payload and leaves a cut-off one as stored', () => {
    expect(displayLines('json', ['{"a":1,"b":"x"}'], false)).toEqual([
      '{',
      '  "a": 1,',
      '  "b": "x"',
      '}',
    ])
    expect(displayLines('json', ['{"a":1'], true)).toEqual(['{"a":1'])
    expect(displayLines('text', EMAIL, false)).toBe(EMAIL)
  })
})
