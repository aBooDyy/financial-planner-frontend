import { describe, expect, it } from 'vitest'
import { buildRow } from './csv/rows'
import {
  counterpartInNote,
  pairTransfers,
  settleTransfer,
  transferLookupOf,
} from './pairing'
import { ROW_ISSUES, emptyAliases } from './types'
import { testContext, testMapping } from './__fixtures__/mapping'
import type { PairCandidate } from './pairing'

const side = (
  index: number,
  out: boolean,
  walletId: string,
  day: number,
  amount = 300,
): PairCandidate => ({ index, out, walletId, day, amount, currency: 'SAR' })

describe('pairTransfers', () => {
  it('pairs a money-out side with a money-in side of the same amount in another wallet', () => {
    const pairs = pairTransfers([
      side(0, true, 'a', 10),
      side(1, false, 'b', 10),
    ])
    expect(pairs.get(0)).toEqual({ partner: 1, walletId: 'b' })
    expect(pairs.get(1)).toEqual({ partner: 0, walletId: 'a' })
  })

  it('never pairs two sides in one wallet, another amount or another currency', () => {
    const pairs = pairTransfers([
      side(0, true, 'a', 10),
      side(1, false, 'a', 10),
      side(2, false, 'b', 10, 301),
      { ...side(3, false, 'b', 10), currency: 'USD' },
    ])
    expect(pairs.size).toBe(0)
  })

  it('prefers the same day, then the closest, and stops at two days apart', () => {
    const pairs = pairTransfers([
      side(0, false, 'b', 12),
      side(1, false, 'b', 11),
      side(2, true, 'a', 10),
      side(3, false, 'c', 10),
      side(4, true, 'a', 10),
      side(5, true, 'a', 20),
      side(6, false, 'b', 23),
    ])
    expect(pairs.get(2)?.partner).toBe(3)
    expect(pairs.get(4)?.partner).toBe(1)
    expect(pairs.has(5)).toBe(false)
    expect(pairs.has(0)).toBe(false)
  })

  it('breaks a tie by file order, so the same file always pairs the same way', () => {
    const candidates = [
      side(0, true, 'a', 10),
      side(1, false, 'b', 10),
      side(2, false, 'c', 10),
      side(3, true, 'a', 10),
    ]
    const once = pairTransfers(candidates)
    const again = pairTransfers([...candidates].reverse())
    expect(once.get(0)?.partner).toBe(1)
    expect(once.get(3)?.partner).toBe(2)
    expect([...again.entries()].sort()).toEqual([...once.entries()].sort())
  })

  it('stays linear on a long file of same-amount transfers', () => {
    const candidates: PairCandidate[] = []
    for (let at = 0; at < 20_000; at += 2) {
      candidates.push(side(at, true, 'a', at % 700))
      candidates.push(side(at + 1, false, 'b', at % 700))
    }
    const started = performance.now()
    const pairs = pairTransfers(candidates)
    expect(pairs.size).toBe(20_000)
    expect(performance.now() - started).toBeLessThan(1_000)
  })
})

describe('counterpartInNote', () => {
  const known = {
    names: [
      { key: 'albilad bank', walletId: 'albilad' },
      { key: 'stc pay', walletId: 'stc' },
      { key: 'home bank', walletId: 'home' },
      { key: 'home bank 2', walletId: 'home2' },
    ],
    currencies: {},
  }

  it('names the one other wallet a note mentions', () => {
    expect(counterpartInNote('Send to STC Pay', 'albilad', known)).toBe('stc')
    expect(
      counterpartInNote('Received from Albilad Bank · ref:8', 'stc', known),
    ).toBe('albilad')
  })

  it('lets a longer name win over one it contains', () => {
    expect(counterpartInNote('Send to Home bank 2', 'albilad', known)).toBe(
      'home2',
    )
    expect(counterpartInNote('Send to Home Bank', 'albilad', known)).toBe(
      'home',
    )
  })

  it('answers nothing for no wallet, two wallets, or only its own', () => {
    expect(counterpartInNote('Groceries', 'albilad', known)).toBeNull()
    expect(
      counterpartInNote('STC Pay to Albilad Bank', 'home', known),
    ).toBeNull()
    expect(counterpartInNote('Albilad Bank', 'albilad', known)).toBeNull()
    expect(counterpartInNote(null, 'albilad', known)).toBeNull()
  })
})

describe('transferLookupOf', () => {
  it('knows the user’s wallet names and the file’s own spellings of them', () => {
    const mapping = testMapping({
      aliases: {
        ...emptyAliases(),
        wallets: {
          'stc pay': { kind: 'wallet', walletId: 'w2' },
          ignored: { kind: 'skip' },
          'home bank': {
            kind: 'create',
            walletId: 'w9',
            name: 'Home',
            currency: 'USD',
          },
        },
      },
    })
    const known = transferLookupOf(mapping, testContext())
    expect(known.names).toEqual([
      { key: 'main', walletId: 'w1' },
      { key: 'stc pay', walletId: 'w2' },
      { key: 'home bank', walletId: 'w9' },
      { key: 'home', walletId: 'w9' },
    ])
    expect(known.currencies).toEqual({ w1: 'SAR', w9: 'USD' })
  })
})

describe('settleTransfer', () => {
  const mapping = testMapping({
    roles: ['date', 'category', 'amount', 'note'],
    aliases: {
      ...emptyAliases(),
      categories: { transfer: { kind: 'transfer' } },
    },
  })
  const context = testContext({
    walletCurrencies: { w1: 'SAR', w2: 'SAR', w3: 'USD' },
    walletNames: { w1: 'Main', w2: 'STC Pay', w3: 'Dollar' },
  })
  const known = transferLookupOf(mapping, context)
  const transferRow = (note: string) =>
    buildRow(['2026-06-16', 'Transfer', '-50', note], 0, mapping, context)

  it('lays a pair on as the partner’s wallet', () => {
    const row = settleTransfer(
      transferRow(''),
      { partner: 4, walletId: 'w2' },
      known,
    )
    expect(row.transfer).toEqual({
      pairIndex: 4,
      counterpartId: 'w2',
      guessed: false,
    })
    expect(row.issues).toEqual([])
  })

  it('reads the other wallet off the note, and says it did', () => {
    const row = settleTransfer(transferRow('Send to STC Pay'), undefined, known)
    expect(row.transfer?.counterpartId).toBe('w2')
    expect(row.issues.map((i) => [i.level, i.code])).toEqual([
      ['warning', ROW_ISSUES.transferGuessed],
    ])
  })

  it('blocks a side with no other wallet, or one in another currency', () => {
    expect(
      settleTransfer(transferRow('cash'), undefined, known).issues[0],
    ).toMatchObject({ level: 'error', code: ROW_ISSUES.transferUnpaired })
    expect(
      settleTransfer(transferRow('to Dollar'), undefined, known).issues[0],
    ).toMatchObject({ level: 'error', code: ROW_ISSUES.transferCurrency })
  })

  it('leaves every other row untouched', () => {
    const plain = buildRow(
      ['2026-06-16', 'Food', '-50', 'Send to STC Pay'],
      0,
      mapping,
      context,
    )
    expect(settleTransfer(plain, undefined, known)).toBe(plain)
  })
})
