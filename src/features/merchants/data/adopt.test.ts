import { describe, expect, it } from 'vitest'
import type { LocalMerchantAlias, OutboxEntry } from '#/db/types'
import { planAdoption } from './adopt'
import { identityKey } from './matching'

const TEMP = 'temp-merchant'
const WINNER = 'winner-merchant'

const alias = (
  id: string,
  merchantId: string,
  raw: string,
): LocalMerchantAlias => ({
  id,
  merchantId,
  normalizedKey: identityKey(raw),
  rawSample: raw,
  origin: 'import',
  createdAt: '',
  version: '',
  dirty: 1,
  deleted: 0,
})

const entry = (over: Partial<OutboxEntry> & { seq: number }): OutboxEntry => ({
  op: 'create',
  entity: 'transaction',
  id: 't1',
  payload: { id: 't1', merchant_id: TEMP, amount: 100 },
  baseVersion: null,
  createdAt: '',
  ...over,
})

describe('planAdoption', () => {
  it('rewrites a still-queued payload instead of enqueueing a second update', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [{ id: 't1', merchantId: TEMP }],
      bills: [],
      streams: [],
      queued: [entry({ seq: 7 })],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.repointTransactionIds).toEqual(['t1'])
    expect(plan.rewrites).toEqual([
      { seq: 7, payload: { id: 't1', merchant_id: WINNER, amount: 100 } },
    ])
    expect(plan.patchTransactionIds).toEqual([])
  })

  it('moves bills and income streams too, keeping a queued one apart from a transaction of the same id', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [],
      bills: [
        { id: 't1', merchantId: TEMP },
        { id: 'b2', merchantId: TEMP },
      ],
      streams: [{ id: 's1', merchantId: TEMP }],
      queued: [
        entry({ seq: 3 }),
        entry({
          seq: 4,
          entity: 'bill',
          payload: { id: 't1', merchant_id: TEMP },
        }),
      ],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.repointBillIds).toEqual(['t1', 'b2'])
    expect(plan.rewrites).toEqual([
      { seq: 4, payload: { id: 't1', merchant_id: WINNER } },
    ])
    expect(plan.patchBillIds).toEqual(['b2'])
    expect(plan.repointIncomeIds).toEqual(['s1'])
    expect(plan.patchIncomeIds).toEqual(['s1'])
    expect(plan.patchTransactionIds).toEqual([])
  })

  it('patches only the rows the server has already seen', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [
        { id: 'queued', merchantId: TEMP },
        { id: 'pushed', merchantId: TEMP },
      ],
      bills: [],
      streams: [],
      queued: [entry({ seq: 1, id: 'queued' })],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.rewrites.map((r) => r.seq)).toEqual([1])
    expect(plan.patchTransactionIds).toEqual(['pushed'])
  })

  it('leaves rows that point at a different merchant alone', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [
        { id: 't1', merchantId: 'someone-else' },
        { id: 't2', merchantId: null },
      ],
      bills: [],
      streams: [],
      queued: [],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.repointTransactionIds).toEqual([])
    expect(plan.patchTransactionIds).toEqual([])
  })

  it('never rewrites a queued delete', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [{ id: 't1', merchantId: TEMP }],
      bills: [],
      streams: [],
      queued: [entry({ seq: 3, op: 'delete', payload: null })],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.rewrites).toEqual([])
    expect(plan.patchTransactionIds).toEqual(['t1'])
  })

  it('ignores queued entries for other entities', () => {
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [{ id: 't1', merchantId: TEMP }],
      bills: [],
      streams: [],
      queued: [entry({ seq: 4, entity: 'budget' })],
      tempAliases: [],
      knownAliases: [],
    })
    expect(plan.rewrites).toEqual([])
    expect(plan.patchTransactionIds).toEqual(['t1'])
  })

  it('folds new spellings and discards ones a third merchant already owns', () => {
    const mine = alias('a1', TEMP, 'CARREFOUR 402')
    const theirs = alias('a2', TEMP, 'NOON.COM')
    const dupe = alias('a3', TEMP, 'carrefour 402')
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [],
      bills: [],
      streams: [],
      queued: [],
      tempAliases: [mine, theirs, dupe],
      knownAliases: [
        mine,
        theirs,
        dupe,
        {
          merchantId: 'third-merchant',
          normalizedKey: identityKey('NOON.COM'),
        },
      ],
    })
    expect(plan.aliasesToFold.map((a) => a.id)).toEqual(['a1'])
    expect(plan.aliasesToDiscard.map((a) => a.id)).toEqual(['a2', 'a3'])
  })

  it('keeps a spelling the winner already owns — the endpoint is idempotent', () => {
    const colliding = alias('a1', TEMP, 'Carrefour')
    const plan = planAdoption({
      tempId: TEMP,
      winnerId: WINNER,
      transactions: [],
      bills: [],
      streams: [],
      queued: [],
      tempAliases: [colliding],
      knownAliases: [
        colliding,
        { merchantId: WINNER, normalizedKey: identityKey('Carrefour') },
      ],
    })
    expect(plan.aliasesToFold.map((a) => a.id)).toEqual(['a1'])
  })
})
