import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { categoryTypesOf } from '../mapping'
import { DEFAULT_DEDUPE, emptyAliases } from '../types'
import type { Dialect, Mapping, RowContext, RowFacts } from '../types'

/** Builders for the mapping-shaped objects every pure-layer test needs. Test asset only. */

export const testDialect = (overrides: Partial<Dialect> = {}): Dialect => ({
  delimiter: ',',
  quote: '"',
  encoding: 'utf-8',
  decimal: '.',
  skipRows: 0,
  hasHeader: true,
  ...overrides,
})

/** Date · description · amount, one signed column — the shape most statements have. */
export const testMapping = (overrides: Partial<Mapping> = {}): Mapping => ({
  dialect: testDialect(),
  dateFormat: 'YYYY-MM-DD',
  dateAmbiguous: false,
  roles: ['date', 'merchant', 'amount'],
  amount: { kind: 'signed', column: 2, negativeMeans: 'spend' },
  amountUnit: 'major',
  defaults: {
    walletId: 'w1',
    currency: 'SAR',
    type: 'spend',
    categoryIds: { spend: catId('other'), income: catId('other_income') },
  },
  aliases: emptyAliases(),
  dedupe: DEFAULT_DEDUPE,
  ...overrides,
})

export const testContext = (
  overrides: Partial<RowContext> = {},
): RowContext => ({
  today: '2026-06-20',
  walletCurrencies: { w1: 'SAR' },
  walletNames: { w1: 'Main' },
  categoryTypes: categoryTypesOf(defaultCatalog(), {}),
  ...overrides,
})

export const testFacts = (overrides: Partial<RowFacts> = {}): RowFacts => ({
  index: 0,
  line: 2,
  raw: ['2026-06-16', 'Bakery', '-12.40'],
  date: '2026-06-16',
  dateCell: '2026-06-16',
  amountMinor: 1240,
  amountCell: '-12.40',
  amountState: 'ok',
  type: 'spend',
  typeDefaulted: false,
  currency: 'SAR',
  currencyCell: '',
  walletId: 'w1',
  walletSkipped: false,
  categoryId: catId('groceries'),
  categoryDefaulted: false,
  intent: 'cashflow',
  counterpartId: null,
  merchantId: null,
  merchantRaw: 'Bakery',
  note: 'Bakery',
  reference: null,
  ragged: false,
  ...overrides,
})
