import { describe, expect, it } from 'vitest'
import type { ScopeOption } from './selectors'
import {
  cashflowBlock,
  dialogTitle,
  entryAccountSections,
  submitLabel,
  transferBlock,
} from './txDialog'

describe('txDialog', () => {
  it('names a new entry generically and an edited one by its type', () => {
    expect(dialogTitle('spend', false)).toBe('New transaction')
    expect(dialogTitle('transfer', true)).toBe('Edit transfer')
  })

  it('says what a spend or income entry still needs', () => {
    expect(cashflowBlock(null, false)).toBe('Add an amount and a wallet')
    expect(cashflowBlock(0, true)).toBe('Add an amount to continue')
    expect(cashflowBlock(500, false)).toBe('Pick a wallet first')
    expect(cashflowBlock(500, true)).toBeNull()
  })

  it('leaves the same-account case to the error beside the accounts', () => {
    expect(transferBlock(null, false)).toBe('Add an amount to continue')
    expect(transferBlock(null, true)).toBeNull()
    expect(transferBlock(25000, false)).toBeNull()
  })

  it('shows a transfer’s live amount on its button', () => {
    const base = { editing: false, currency: 'SAR' as const }
    expect(submitLabel({ ...base, type: 'spend', amountMinor: 100 })).toBe(
      'Add',
    )
    expect(
      submitLabel({ ...base, type: 'income', editing: true, amountMinor: 1 }),
    ).toBe('Save')
    expect(submitLabel({ ...base, type: 'transfer', amountMinor: 0 })).toBe(
      'Save transfer',
    )
    expect(
      submitLabel({ ...base, type: 'transfer', amountMinor: 25000 }),
    ).toMatch(/^Save transfer · .*250\.00$/)
  })
})

describe('entryAccountSections', () => {
  const opt = (
    value: string,
    kind: ScopeOption['kind'],
    depth = 0,
  ): ScopeOption => ({
    value,
    kind,
    name: value,
    amountStr: '',
    color: null,
    icon: null,
    depth,
  })

  it('drops All accounts and groups with no wallet under them', () => {
    const sections = entryAccountSections(
      [
        { label: null, options: [opt('all', 'all')] },
        {
          label: null,
          options: [
            opt('group:bank', 'group'),
            opt('group:empty', 'group', 1),
            opt('wallet:main', 'wallet', 1),
          ],
        },
        { label: null, options: [opt('group:bare', 'group')] },
        { label: 'Not in a group', options: [opt('wallet:cash', 'wallet')] },
      ],
      null,
    )
    expect(sections.map((s) => s.options.map((o) => o.value))).toEqual([
      ['group:bank', 'wallet:main'],
      ['wallet:cash'],
    ])
  })

  it('adds the archived wallet an edited entry still uses', () => {
    const sections = entryAccountSections([], {
      id: 'old',
      name: 'Old card',
      color: '#999999',
      icon: 'wallet',
      currency: 'SAR',
      balance: 0,
    })
    expect(sections).toEqual([
      expect.objectContaining({
        label: 'Archived',
        options: [expect.objectContaining({ value: 'wallet:old' })],
      }),
    ])
  })
})
