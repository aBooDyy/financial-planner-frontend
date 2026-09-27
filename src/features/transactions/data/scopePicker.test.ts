import { describe, expect, it } from 'vitest'
import type { FilterOption, Scope, ScopeSection } from './selectors'
import { scopeFromValue, scopeToValue } from './selectors'
import {
  ancestorValues,
  isCovered,
  scopeBalance,
  scopeLabel,
  togglePick,
} from './scopePicker'

const option = (
  value: string,
  depth = 0,
  name = value.split(':')[1] ?? 'All accounts',
): FilterOption => ({
  value,
  kind:
    value === 'all' ? 'all' : value.startsWith('group:') ? 'group' : 'wallet',
  name,
  amountStr: '',
  baseMinor: 0,
  color: null,
  icon: null,
  depth,
})

// Personal ▸ (Main, Savings ▸ (Jar)); Business ▸ (Main); loose Cash.
const SECTIONS: ScopeSection<FilterOption>[] = [
  { label: null, options: [option('all')] },
  {
    label: null,
    options: [
      option('group:personal', 0, 'Personal'),
      option('wallet:p-main', 1, 'Main'),
      option('group:savings', 1, 'Savings'),
      option('wallet:jar', 2, 'Jar'),
    ],
  },
  {
    label: null,
    options: [
      option('group:business', 0, 'Business'),
      option('wallet:b-main', 1, 'Main'),
    ],
  },
  { label: 'Not in a group', options: [option('wallet:cash', 0, 'Cash')] },
]
const ANCESTORS = ancestorValues(SECTIONS)
const ALL: Scope = { type: 'all' }

const tick = (scope: Scope, ...values: string[]) =>
  values.reduce((s, v) => togglePick(s, v, ANCESTORS), scope)

describe('the account multi-select', () => {
  it('reads each option’s groups off the tree', () => {
    expect(ANCESTORS.get('wallet:jar')).toEqual([
      'group:personal',
      'group:savings',
    ])
    expect(ANCESTORS.get('wallet:b-main')).toEqual(['group:business'])
    expect(ANCESTORS.get('wallet:cash')).toEqual([])
  })

  it('is one account for one tick and several for more, and everything once all are unticked', () => {
    expect(tick(ALL, 'wallet:cash')).toEqual({ type: 'wallet', id: 'cash' })
    expect(tick(ALL, 'wallet:cash', 'group:business')).toEqual({
      type: 'accounts',
      picks: [
        { type: 'wallet', id: 'cash' },
        { type: 'group', id: 'business' },
      ],
    })
    expect(tick(ALL, 'wallet:cash', 'wallet:cash')).toEqual(ALL)
  })

  it('folds the picks beneath a ticked group into it, and keeps them from being unticked alone', () => {
    const scope = tick(ALL, 'wallet:jar', 'wallet:cash', 'group:personal')
    expect(scope).toEqual({
      type: 'accounts',
      picks: [
        { type: 'wallet', id: 'cash' },
        { type: 'group', id: 'personal' },
      ],
    })
    expect(isCovered(scope, 'wallet:jar', ANCESTORS)).toBe(true)
    expect(tick(scope, 'wallet:jar')).toBe(scope)
  })

  it('names what is ticked', () => {
    expect(scopeLabel(ALL, SECTIONS)).toBe('All accounts')
    expect(scopeLabel(tick(ALL, 'wallet:cash'), SECTIONS)).toBe('Cash')
    expect(
      scopeLabel(tick(ALL, 'wallet:cash', 'group:business'), SECTIONS),
    ).toBe('Cash + Business')
    expect(
      scopeLabel(
        tick(ALL, 'wallet:cash', 'group:business', 'wallet:jar'),
        SECTIONS,
      ),
    ).toBe('3 accounts')
  })

  it('round-trips a scope through its memo key', () => {
    const scope = tick(ALL, 'wallet:cash', 'group:business')
    expect(scopeFromValue(scopeToValue(scope))).toEqual(scope)
    expect(scopeFromValue(scopeToValue(ALL))).toEqual(ALL)
  })
})

describe('the chosen accounts’ balance', () => {
  const funded = (o: FilterOption, amountStr: string, baseMinor: number) => ({
    ...o,
    amountStr,
    baseMinor,
  })
  const FUNDED: ScopeSection<FilterOption>[] = [
    { label: null, options: [funded(option('all'), 'SR 900', 90000)] },
    {
      label: null,
      options: [
        funded(option('group:business', 0, 'Business'), 'SR 500', 50000),
        funded(option('wallet:b-main', 1, 'Main'), 'SR 500', 50000),
      ],
    },
    {
      label: null,
      options: [funded(option('wallet:usd', 0, 'Dollars'), '$100', 37500)],
    },
  ]

  it('is the one balance for everything or a single account', () => {
    expect(scopeBalance(ALL, FUNDED, 'SAR')).toEqual({
      label: 'All accounts',
      amountStr: 'SR 900',
      parts: [],
    })
    expect(scopeBalance({ type: 'wallet', id: 'usd' }, FUNDED, 'SAR')).toEqual({
      label: 'Dollars',
      amountStr: '$100',
      parts: [],
    })
  })

  it('totals several picks in the base currency and lists each in its own', () => {
    const scope: Scope = {
      type: 'accounts',
      picks: [
        { type: 'group', id: 'business' },
        { type: 'wallet', id: 'usd' },
      ],
    }
    const balance = scopeBalance(scope, FUNDED, 'SAR')
    expect(balance.label).toBe('Total')
    expect(balance.amountStr).toMatch(/875$/)
    expect(balance.parts).toEqual([
      { name: 'Business', amountStr: 'SR 500' },
      { name: 'Dollars', amountStr: '$100' },
    ])
  })
})
