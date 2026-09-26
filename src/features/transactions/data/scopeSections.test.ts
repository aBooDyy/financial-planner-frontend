import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import { walletDeltas } from './ledger'
import type { SpendingData } from './selectors'
import { offeredScope, scopeSections as sectionsOf } from './selectors'

function node(over: Partial<LocalBalanceNode> & { id: string }) {
  return {
    kind: 'wallet',
    parentId: null,
    name: over.id,
    color: '#1F9D6B',
    icon: null,
    note: null,
    position: 0,
    collapsed: false,
    archivedAt: null,
    amount: 10000,
    currency: 'SAR',
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  } satisfies LocalBalanceNode
}

const group = (id: string, over: Partial<LocalBalanceNode> = {}) =>
  node({ id, kind: 'group', amount: null, currency: null, ...over })

const spending = (nodes: LocalBalanceNode[]): SpendingData => ({
  txns: [],
  budgets: [],
  recurrings: [],
  nodes,
  base: 'SAR',
  rates: { SAR: 1 },
  allocations: [],
  goals: [],
})

const scopeSections = (data: SpendingData) =>
  sectionsOf(data, walletDeltas(data.nodes, data.txns, data.rates))

const summary = (data: SpendingData) =>
  scopeSections(data).map((s) => ({
    label: s.label,
    options: s.options.map((o) => `${'  '.repeat(o.depth)}${o.value}`),
  }))

describe('scopeSections', () => {
  it('nests wallets under their groups and keeps loose wallets apart', () => {
    const data = spending([
      group('bank', { position: 0 }),
      node({ id: 'checking', parentId: 'bank' }),
      group('jars', { parentId: 'bank', position: 1 }),
      node({ id: 'travel', parentId: 'jars' }),
      node({ id: 'cash', position: 1 }),
    ])
    expect(summary(data)).toEqual([
      { label: null, options: ['all'] },
      {
        label: null,
        options: [
          'group:bank',
          '  wallet:checking',
          '  group:jars',
          '    wallet:travel',
        ],
      },
      { label: 'Not in a group', options: ['wallet:cash'] },
    ])
    expect(scopeSections(data)[1].options[0].amountStr).toContain('200')
  })

  it('leaves archived accounts out, and falls back to all when one was chosen', () => {
    const data = spending([
      group('old', { archivedAt: '2026-09-01T00:00:00Z' }),
      node({ id: 'inside', parentId: 'old' }),
      node({ id: 'cash' }),
    ])
    const sections = scopeSections(data)
    expect(summary(data)).toEqual([
      { label: null, options: ['all'] },
      { label: 'Wallets', options: ['wallet:cash'] },
    ])
    expect(sections[0].options[0].amountStr).toContain('100')
    expect(offeredScope(sections, { type: 'wallet', id: 'inside' })).toEqual({
      type: 'all',
    })
    expect(offeredScope(sections, { type: 'wallet', id: 'cash' })).toEqual({
      type: 'wallet',
      id: 'cash',
    })
  })
})
