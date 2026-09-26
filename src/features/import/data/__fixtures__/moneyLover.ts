import { loadFixture } from '../csv/__fixtures__/fixtures'
import { readCsv } from '../csv/read'
import { draftForFile, toMapping } from '../mapping'
import { distinctValues } from '../matching'
import { proposalsFor, seedFor, withAliases } from '../values'
import { roleColumn } from '../types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { testContext } from './mapping'
import type { Mapping, RowContext } from '../types'

/**
 * The Money Lover fixture read and mapped the way a user would answer step ③: each file
 * wallet bound to one of theirs, and the category column left to our proposals — which is
 * what turns "Transfer" and "Balance adjustment" into movements. Test asset only.
 */

export const MONEY_LOVER_WALLETS: Readonly<Record<string, string>> = {
  w1: 'Albilad Bank',
  w2: 'STC Pay',
  w3: 'My Wallet',
  w4: 'Home Bank',
}

export const moneyLover = (): {
  matrix: string[][]
  mapping: Mapping
  context: RowContext
} => {
  const read = readCsv(loadFixture('money-lover.csv').bytes, {
    limits: { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 },
  })
  const draft = draftForFile({
    dialect: read.dialect,
    headers: read.headers,
    matrix: read.rows,
    currency: 'SAR',
    fallbackCategories: {
      spend: catId('other'),
      income: catId('other_income'),
    },
  })
  const categories = distinctValues(
    read.rows,
    roleColumn(draft.roles, 'category'),
  )
  const proposals = proposalsFor('category', categories, {
    wallets: [],
    categories: [],
    merchants: { merchants: [], aliases: [] },
  })
  let aliases = withAliases(
    draft.aliases,
    'category',
    seedFor('category', categories, draft.aliases, proposals),
  )
  aliases = withAliases(
    aliases,
    'wallet',
    Object.entries(MONEY_LOVER_WALLETS).map(([id, name]) => ({
      key: name.toLowerCase(),
      value: id,
    })),
  )
  const mapping = toMapping({ ...draft, aliases })
  if (mapping === null) throw new Error('the fixture should map completely')
  return {
    matrix: read.rows,
    mapping,
    context: testContext({
      today: '2026-09-20',
      walletCurrencies: { w1: 'SAR', w2: 'SAR', w3: 'SAR', w4: 'SAR' },
      walletNames: MONEY_LOVER_WALLETS,
    }),
  }
}
