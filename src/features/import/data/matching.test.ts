import { describe, expect, it } from 'vitest'
import { buildCatalog } from '#/features/categories/data/catalog'
import { normalizeKey as merchantKey } from '#/features/merchants/data/matching'
import {
  categoryOptions,
  distinctValues,
  matchCategory,
  matchCurrency,
  matchType,
  matchWallet,
  normalizeKey,
  resolveWallet,
  walletOptionsFrom,
} from './matching'
import type { LocalCategory } from '#/db/types'
import type { WalletOption } from './matching'

const categoryRow = (
  over: Partial<LocalCategory> & { slug: string; name: string },
): LocalCategory => ({
  id: over.slug,
  parentId: null,
  type: 'spend',
  color: '#1F9D6B',
  icon: null,
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

const wallet = (id: string, name: string): WalletOption => ({
  id,
  name,
  currency: 'SAR',
})

const WALLETS: WalletOption[] = [
  wallet('w1', 'Al Rajhi Current'),
  wallet('w2', 'Savings'),
  wallet('w3', 'CURRENT ****4471'),
  wallet('w4', 'CURRENT ****9902'),
]

describe('normalizeKey', () => {
  it('folds case, punctuation and diacritics', () => {
    expect(normalizeKey('  Café — Épargne!  ')).toBe('cafe epargne')
    expect(normalizeKey('AL-RAJHI / Current')).toBe('al rajhi current')
  })

  it('keeps digits, so two cards never collapse into one account', () => {
    expect(normalizeKey('CURRENT ****4471')).toBe('current 4471')
    expect(normalizeKey('CURRENT ****9902')).toBe('current 9902')
    expect(normalizeKey('CURRENT ****4471')).not.toBe(
      normalizeKey('CURRENT ****9902'),
    )
  })

  it('keeps letters of every script, unlike the merchant normaliser', () => {
    expect(normalizeKey('حساب جاري')).toBe('حساب جاري')
    expect(merchantKey('حساب جاري')).toBe('')
  })

  it('folds Arabic tashkeel and hamza forms', () => {
    expect(normalizeKey('إيداع')).toBe(normalizeKey('ايداع'))
  })
})

describe('matchWallet', () => {
  it('matches an exact name outright', () => {
    const match = matchWallet('al rajhi current', WALLETS)
    expect(match?.target.id).toBe('w1')
    expect(match?.score).toBe(100)
    expect(match?.tier).toBe('auto')
  })

  it('keeps two cards apart', () => {
    expect(matchWallet('CURRENT ****4471', WALLETS)?.target.id).toBe('w3')
    expect(matchWallet('CURRENT ****9902', WALLETS)?.target.id).toBe('w4')
  })

  it('matches a whole-token run at the auto tier', () => {
    const match = matchWallet('Al Rajhi Current Account 1', WALLETS)
    expect(match?.target.id).toBe('w1')
    expect(match?.score).toBe(70)
    expect(match?.tier).toBe('auto')
  })

  it('offers a token-overlap match for checking, not for applying', () => {
    const match = matchWallet('Al Rajhi Savings Account', [
      wallet('w5', 'Al Rajhi Current Account'),
    ])
    expect(match?.tier).toBe('check')
    expect(match?.score).toBeLessThan(70)
    expect(match?.score).toBeGreaterThanOrEqual(40)
  })

  it('forgives a typo in a short name', () => {
    const match = matchWallet('Savngs', WALLETS)
    expect(match?.target.id).toBe('w2')
    expect(match?.score).toBe(60)
  })

  it('offers nothing below the check threshold', () => {
    expect(matchWallet('Nothing like it', WALLETS)).toBeNull()
    expect(matchWallet('   ', WALLETS)).toBeNull()
  })

  it('also scores the group path a wallet sits in', () => {
    const grouped = walletOptionsFrom([
      { label: 'Cards', wallets: [{ id: 'w6', name: 'Visa' }] },
    ])
    expect(matchWallet('Cards Visa', grouped)?.target.id).toBe('w6')
  })

  it('reads a spaceless bank spelling of a name a person spaced', () => {
    const grouped = walletOptionsFrom([
      { label: 'Al Rajhi', wallets: [{ id: 'w7', name: 'Current' }] },
    ])
    expect(matchWallet('ALRAJHI', grouped)?.score).toBe(100)
    expect(matchWallet('AL RAJHI', grouped)?.target.id).toBe('w7')
    expect(matchWallet('al-rajhi', grouped)?.target.id).toBe('w7')
  })

  it('still keeps two cards apart once spaces stop counting', () => {
    expect(matchWallet('CURRENT****4471', WALLETS)?.target.id).toBe('w3')
    expect(matchWallet('CURRENT****9902', WALLETS)?.target.id).toBe('w4')
  })
})

describe('resolveWallet — the group a file names', () => {
  const groupOf = (...wallets: Array<{ id: string; name: string }>) =>
    walletOptionsFrom([
      { label: 'Al Bilad', wallets },
      { label: null, wallets: [{ id: 'cash', name: 'Cash' }] },
    ])

  const ONE = groupOf({ id: 'w1', name: 'Main' })
  const TWO = groupOf({ id: 'w1', name: 'Main' }, { id: 'w2', name: 'Savings' })

  it('binds the group name when the group holds one account', () => {
    expect(resolveWallet('Al Bilad', ONE)).toMatchObject({
      kind: 'wallet',
      score: 100,
      tier: 'auto',
    })
    expect(matchWallet('Al Bilad', ONE)?.target.id).toBe('w1')
  })

  it('reaches that account however the bank spells the group', () => {
    for (const spelling of ['ALBILAD', 'AL BILAD', 'al-bilad']) {
      expect(matchWallet(spelling, ONE)?.target.id).toBe('w1')
    }
  })

  it('refuses to choose when the group holds several accounts', () => {
    const resolved = resolveWallet('Al Bilad', TWO)

    expect(resolved).toMatchObject({ kind: 'ambiguous', group: 'Al Bilad' })
    expect(
      resolved?.kind === 'ambiguous'
        ? resolved.wallets.map((option) => option.id)
        : [],
    ).toEqual(['w1', 'w2'])
    expect(matchWallet('Al Bilad', TWO)).toBeNull()
    expect(matchWallet('ALBILAD', TWO)).toBeNull()
  })

  it('binds the account once the file names it too', () => {
    expect(matchWallet('Al Bilad Main', TWO)?.target.id).toBe('w1')
    expect(matchWallet('Main', TWO)?.target.id).toBe('w1')
  })

  it('never breaks a tie between two accounts', () => {
    const twins = walletOptionsFrom([
      { label: 'Al Bilad', wallets: [{ id: 'w1', name: 'Savings' }] },
      { label: 'Al Rajhi', wallets: [{ id: 'w2', name: 'Savings' }] },
    ])
    const resolved = resolveWallet('Savings', twins)

    expect(resolved).toMatchObject({ kind: 'ambiguous', group: null })
    expect(matchWallet('Savings', twins)).toBeNull()
  })
})

describe('matchCategory', () => {
  const options = categoryOptions(buildCatalog([]))

  it('matches a catalog parent', () => {
    const match = matchCategory('Groceries', options)
    expect(match?.target.category).toBe('groceries')
    expect(match?.target.subcategory).toBeNull()
  })

  it('matches a subcategory, alone or with its parent', () => {
    expect(matchCategory('Supermarket', options)?.target).toMatchObject({
      category: 'groceries',
      subcategory: 'supermarket',
    })
    expect(
      matchCategory('Groceries: Supermarket', options)?.target,
    ).toMatchObject({ category: 'groceries', subcategory: 'supermarket' })
  })

  it('reads the user’s own names, not the built-in ones', () => {
    const mine = categoryOptions(
      buildCatalog([categoryRow({ slug: 'groceries', name: 'Food shopping' })]),
    )
    expect(matchCategory('Food shopping', mine)?.target.category).toBe(
      'groceries',
    )
    expect(matchCategory('Groceries', mine)).toBeNull()
  })

  it('offers a subcategory the user created, under its own parent', () => {
    const mine = categoryOptions(
      buildCatalog([
        categoryRow({ slug: 'groceries', name: 'Groceries' }),
        categoryRow({
          id: 'sub-1',
          slug: 'farmers_market',
          name: 'Farmers market',
          parentId: 'groceries',
        }),
      ]),
    )
    expect(matchCategory('Farmers market', mine)?.target).toMatchObject({
      category: 'groceries',
      subcategory: 'farmers_market',
    })
  })

  it('offers nothing for a category it has never heard of', () => {
    expect(matchCategory('Kids school', options)).toBeNull()
  })
})

describe('matchType', () => {
  it('reads the seed dictionary in both languages', () => {
    expect(matchType('DR')).toBe('spend')
    expect(matchType('Withdrawal')).toBe('spend')
    expect(matchType('مدين')).toBe('spend')
    expect(matchType('CR')).toBe('income')
    expect(matchType('Deposit')).toBe('income')
    expect(matchType('دائن')).toBe('income')
  })

  it('asks about anything else', () => {
    expect(matchType('BGC')).toBeNull()
    expect(matchType('')).toBeNull()
  })
})

describe('matchCurrency', () => {
  it('binds an ISO code', () => {
    expect(matchCurrency('sar')).toBe('SAR')
    expect(matchCurrency(' JPY ')).toBe('JPY')
  })

  it('binds a full currency name', () => {
    expect(matchCurrency('Saudi Riyal')).toBe('SAR')
  })

  it('binds a symbol only one currency owns', () => {
    expect(matchCurrency('€')).toBe('EUR')
  })

  it('refuses a symbol several currencies share', () => {
    expect(matchCurrency('$')).toBeNull()
    expect(matchCurrency('£')).toBeNull()
  })

  it('refuses a label that is not a currency at all', () => {
    expect(matchCurrency('BTC')).toBeNull()
  })
})

describe('distinctValues', () => {
  it('counts each spelling once, most frequent first', () => {
    const rows = [
      ['a', 'CURRENT ****4471'],
      ['b', 'current ****4471'],
      ['c', 'SAVINGS ****9902'],
      ['d', 'CURRENT ****4471'],
    ]
    expect(distinctValues(rows, 1)).toEqual([
      { raw: 'CURRENT ****4471', key: 'current 4471', count: 3 },
      { raw: 'SAVINGS ****9902', key: 'savings 9902', count: 1 },
    ])
  })
})
