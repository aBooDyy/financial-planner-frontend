import { describe, expect, it } from 'vitest'
import { sectionByGroup } from './walletSections'
import type { WalletGroupOption } from './selectors'

const groups: WalletGroupOption[] = [
  { label: null, wallets: [{ id: 'cash', name: 'Cash' }] },
  {
    label: 'Banks',
    wallets: [
      { id: 'current', name: 'Current' },
      { id: 'savings', name: 'Savings' },
    ],
  },
  { label: 'Banks › Joint', wallets: [{ id: 'joint', name: 'Joint' }] },
]

const rows = (...ids: string[]) => ids.map((id) => ({ id }))

describe('sectionByGroup', () => {
  it('puts each row under its group, in tree order', () => {
    expect(
      sectionByGroup(groups, rows('joint', 'savings', 'cash', 'current')),
    ).toEqual([
      { label: null, items: rows('cash') },
      { label: 'Banks', items: rows('current', 'savings') },
      { label: 'Banks › Joint', items: rows('joint') },
    ])
  })

  it('drops groups left empty by a filtered list', () => {
    expect(sectionByGroup(groups, rows('savings'))).toEqual([
      { label: 'Banks', items: rows('savings') },
    ])
  })

  it('keeps a row the tree does not place, last and unlabelled', () => {
    expect(sectionByGroup(groups, rows('gone', 'cash'))).toEqual([
      { label: null, items: rows('cash') },
      { label: null, items: rows('gone') },
    ])
  })
})
