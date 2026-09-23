import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { buildRow } from './csv/rows'
import { applyRowPatch } from './rowEdits'
import { hasErrors } from './types'

const mapping = testMapping()
const context = testContext()

const row = (cells: string[]) => buildRow(cells, 0, mapping, context)

describe('applyRowPatch', () => {
  it('turns an unreadable amount into a committable row', () => {
    const broken = row(['2026-06-16', 'REFUND', 'N/A'])
    expect(broken.draft).toBeNull()
    expect(hasErrors(broken.issues)).toBe(true)

    const fixed = applyRowPatch(broken, { amountMinor: 3400 }, mapping, context)

    expect(fixed.draft?.amount).toBe(3400)
    expect(hasErrors(fixed.issues)).toBe(false)
    expect(fixed.fingerprint).not.toBe('')
  })

  it('treats a corrected category as an answer, not a guess', () => {
    const guessed = row(['2026-06-16', 'Bakery', '-12.40'])
    const before = guessed.issues.map((issue) => issue.code)
    expect(before).toContain('import.row.category_defaulted')

    const fixed = applyRowPatch(
      guessed,
      { category: 'dining', subcategory: 'cafes' },
      mapping,
      context,
    )

    expect(fixed.draft?.category).toBe('dining')
    expect(fixed.draft?.subcategory).toBe('cafes')
    expect(fixed.issues.map((issue) => issue.code)).not.toContain(
      'import.row.category_defaulted',
    )
  })

  it('carries the duplicate marks across, and an empty patch changes nothing', () => {
    const base = {
      ...row(['2026-06-16', 'Bakery', '-12.40']),
      duplicateOf: 't1',
    }

    expect(applyRowPatch(base, {}, mapping, context)).toBe(base)
    expect(
      applyRowPatch(base, { note: 'Corrected' }, mapping, context).duplicateOf,
    ).toBe('t1')
  })

  it('re-reads the row’s own cells, so a later mapping change still reaches it', () => {
    const base = row(['2026-06-16', 'Bakery', '-12.40'])
    const inMinor = testMapping({ amountUnit: 'minor' })

    const fixed = applyRowPatch(base, { note: 'Corrected' }, inMinor, context)

    expect(fixed.draft?.amount).toBe(12)
    expect(fixed.draft?.note).toBe('Corrected')
  })
})
