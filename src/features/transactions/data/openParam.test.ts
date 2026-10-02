import { describe, expect, it } from 'vitest'
import { encodeOpenParam, parseOpenParam } from './openParam'

const ID = '0192f0c4-7b1e-7c3a-9d2e-4f5a6b7c8d9e'

describe('parseOpenParam', () => {
  it('reads every kind the Spending page opens', () => {
    for (const kind of ['tx', 'adjustment', 'transfer', 'budget'] as const)
      expect(parseOpenParam(`${kind}:${ID}`)).toEqual({ kind, id: ID })
  })

  it('round-trips what it encodes', () => {
    const intent = { kind: 'transfer', id: ID } as const
    expect(parseOpenParam(encodeOpenParam(intent))).toEqual(intent)
  })

  it('drops anything malformed', () => {
    expect(parseOpenParam(undefined)).toBeNull()
    expect(parseOpenParam(42)).toBeNull()
    expect(parseOpenParam('')).toBeNull()
    expect(parseOpenParam(ID)).toBeNull()
    expect(parseOpenParam(`account:${ID}`)).toBeNull()
    expect(parseOpenParam(`planned:${ID}`)).toBeNull()
    expect(parseOpenParam('tx:not-an-id')).toBeNull()
    expect(parseOpenParam(`tx:${ID}:extra`)).toBeNull()
  })
})
