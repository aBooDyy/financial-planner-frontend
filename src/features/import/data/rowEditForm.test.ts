import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { buildRow } from './csv/rows'
import { formFor, formValid, patchFor } from './rowEditForm'
import { emptyAliases } from './types'

const mapping = testMapping({
  roles: ['date', 'category', 'amount', 'note'],
  aliases: {
    ...emptyAliases(),
    categories: { transfer: { kind: 'transfer' } },
  },
})
const context = testContext()
const row = (category: string) =>
  buildRow(['2026-06-16', category, '-50', 'x'], 0, mapping, context)

describe('the row editor as data', () => {
  it('opens a transfer as one, with its direction beside it', () => {
    const form = formFor(row('Transfer'), mapping.defaults)
    expect(form).toMatchObject({ kind: 'transfer', flow: 'spend' })
  })

  it('needs another account before a transfer can be saved', () => {
    const form = formFor(row('Transfer'), mapping.defaults)
    expect(formValid(form)).toBe(false)
    expect(formValid({ ...form, counterpartId: 'w1' })).toBe(false)
    expect(formValid({ ...form, counterpartId: 'w2' })).toBe(true)
  })

  it('patches only what changed — a spend turned into a transfer in', () => {
    const initial = formFor(row('Food'), mapping.defaults)
    expect(initial.kind).toBe('spend')
    const patch = patchFor(initial, {
      ...initial,
      kind: 'transfer',
      flow: 'income',
      counterpartId: 'w2',
    })
    expect(patch).toEqual({
      intent: 'transfer',
      type: 'income',
      counterpartId: 'w2',
    })
  })

  it('turns a transfer back into income without touching its category', () => {
    const initial = formFor(row('Transfer'), mapping.defaults)
    expect(patchFor(initial, { ...initial, kind: 'income' })).toEqual({
      intent: 'cashflow',
      type: 'income',
    })
  })
})
