import { describe, expect, it } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import { activeNodes, hasArchivedAncestor, hiddenByArchive } from './archive'
import { archiveTarget, buildArchivedList } from './archivedList'
import { walletGroupOptions } from './selectors'

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
    amount: 0,
    currency: 'SAR',
    createdAt: '',
    updatedAt: '',
    version: '',
    dirty: 0,
    deleted: 0,
    ...over,
  } satisfies LocalBalanceNode
}

const bank = node({
  id: 'bank',
  kind: 'group',
  amount: null,
  currency: null,
  archivedAt: '2026-09-01T10:00:00Z',
})
const checking = node({ id: 'checking', parentId: 'bank', amount: 50000 })
const card = node({
  id: 'card',
  parentId: 'bank',
  archivedAt: '2026-09-10T10:00:00Z',
})
const cash = node({ id: 'cash', amount: 1000 })
const nodes = [bank, checking, card, cash]
const money = { deltas: { checking: -10000 }, base: 'SAR', rates: { SAR: 1 } }

describe('archive', () => {
  it('hides an archived group together with everything inside it', () => {
    expect([...hiddenByArchive(nodes)].sort()).toEqual([
      'bank',
      'card',
      'checking',
    ])
    expect(activeNodes(nodes).map((n) => n.id)).toEqual(['cash'])
  })

  it('drops deleted nodes from the active tree too', () => {
    expect(activeNodes([cash, node({ id: 'gone', deleted: 1 })])).toEqual([
      cash,
    ])
  })

  it('survives a parent cycle', () => {
    const a = node({ id: 'a', parentId: 'b' })
    const b = node({ id: 'b', parentId: 'a', archivedAt: 'x' })
    expect(hiddenByArchive([a, b]).size).toBe(2)
  })

  it('knows when a restore would leave a node inside an archived group', () => {
    expect(hasArchivedAncestor(nodes, card)).toBe(true)
    expect(hasArchivedAncestor(nodes, cash)).toBe(false)
  })

  it('keeps archived wallets out of pickers', () => {
    expect(walletGroupOptions(nodes)).toEqual([
      { label: null, wallets: [{ id: 'cash', name: 'cash' }] },
    ])
  })

  it('describes what an archive takes away', () => {
    const live = [{ ...bank, archivedAt: null }, checking, cash]
    expect(archiveTarget(live, 'bank', money)).toEqual({
      id: 'bank',
      kind: 'group',
      name: 'bank',
      walletCount: 1,
      holdingStr: expect.stringContaining('400'),
    })
    const empty = node({ id: 'empty' })
    expect(archiveTarget([empty], 'empty', money)?.holdingStr).toBeNull()
  })

  it('lists archived nodes newest first, flagging a stranded one', () => {
    const list = buildArchivedList(nodes, money, 'dmy')
    expect(list.map((i) => i.id)).toEqual(['card', 'bank'])
    expect(list[0]).toMatchObject({
      placeName: 'bank',
      stranded: true,
      archivedStr: '10/09/2026',
    })
    expect(list[1]).toMatchObject({ walletCount: 2, stranded: false })
  })
})
