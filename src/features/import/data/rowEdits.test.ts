import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { buildRow } from './csv/rows'
import { settleTransfer, transferLookupOf } from './pairing'
import { applyRowPatch, breaksPair } from './rowEdits'
import { emptyAliases, hasErrors } from './types'

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

describe('applyRowPatch — transfers', () => {
  const transferMapping = testMapping({
    roles: ['date', 'category', 'amount', 'note'],
    aliases: {
      ...emptyAliases(),
      categories: { transfer: { kind: 'transfer' } },
    },
  })
  const transferContext = testContext({
    walletCurrencies: { w1: 'SAR', w2: 'SAR' },
    walletNames: { w1: 'Main', w2: 'Savings' },
  })
  const paired = settleTransfer(
    buildRow(
      ['2026-06-16', 'Transfer', '-50', ''],
      0,
      transferMapping,
      transferContext,
    ),
    { partner: 3, walletId: 'w2' },
    transferLookupOf(transferMapping, transferContext),
  )

  it('keeps the pair across a correction that leaves its matched fields alone', () => {
    const fixed = applyRowPatch(
      paired,
      { note: 'rent pot' },
      transferMapping,
      transferContext,
    )
    expect(fixed.transfer?.pairIndex).toBe(3)
    expect(hasErrors(fixed.issues)).toBe(false)
  })

  it('stands a row alone once its pair is broken, and takes the wallet the user named', () => {
    const alone = applyRowPatch(
      paired,
      { unpaired: true },
      transferMapping,
      transferContext,
    )
    expect(alone.transfer?.pairIndex).toBeNull()
    expect(hasErrors(alone.issues)).toBe(true)
    const named = applyRowPatch(
      paired,
      { unpaired: true, counterpartId: 'w2' },
      transferMapping,
      transferContext,
    )
    expect(named.transfer).toEqual({
      pairIndex: null,
      counterpartId: 'w2',
      guessed: false,
    })
    expect(hasErrors(named.issues)).toBe(false)
  })

  it('knows which fields a pair was matched on', () => {
    expect(breaksPair({ note: 'x' })).toBe(false)
    expect(breaksPair({ amountMinor: 1 })).toBe(true)
    expect(breaksPair({ intent: 'cashflow' })).toBe(true)
  })

  it('turns a spend into a movement with no category warning', () => {
    const spend = buildRow(
      ['2026-06-16', 'Stuff', '-50', ''],
      0,
      transferMapping,
      transferContext,
    )
    expect(spend.issues.map((i) => i.code)).toContain(
      'import.row.category_defaulted',
    )
    const adjusted = applyRowPatch(
      spend,
      { intent: 'adjustment' },
      transferMapping,
      transferContext,
    )
    expect(adjusted.intent).toBe('adjustment')
    expect(adjusted.issues).toEqual([])
  })
})
