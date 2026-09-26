import type { TxType } from '#/features/transactions/api/types'
import type { TransactionDraft } from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import type { DateFormatToken } from './csv/dates'

/** Where an import's rows came from. */
export type ImportSource = 'inbox' | 'csv'

/**
 * How a CSV file is to be read. Everything in it is a *proposal* produced by detection,
 * shown in the Adjust dialog and overridable there, and persisted into a template once the
 * user commits — so a second statement from the same bank needs no detection at all.
 */
export type Dialect = {
  delimiter: string
  quote: string
  encoding: string
  decimal: '.' | ','
  /** Preamble lines above the header — bank exports carry 3–6 of them. */
  skipRows: number
  hasHeader: boolean
}

// --- The mapping model ---------------------------------------------------------------

/** What one column of the file holds. Every column has exactly one role. */
export type ColumnRole =
  | 'skip'
  | 'date'
  | 'amount'
  | 'amountOut'
  | 'amountIn'
  | 'type'
  | 'currency'
  | 'wallet'
  | 'category'
  | 'subcategory'
  | 'merchant'
  | 'note'
  | 'reference'

export const COLUMN_ROLES: ReadonlyArray<ColumnRole> = [
  'skip',
  'date',
  'amount',
  'amountOut',
  'amountIn',
  'type',
  'currency',
  'wallet',
  'category',
  'subcategory',
  'merchant',
  'note',
  'reference',
]

/** A role at most one column may hold. `skip` and `note` may repeat. */
export const isExclusiveRole = (role: ColumnRole): boolean =>
  role !== 'skip' && role !== 'note'

/** The column holding a role, or -1. Roles are the single source of column meaning. */
export const roleColumn = (
  roles: ReadonlyArray<ColumnRole>,
  role: ColumnRole,
): number => roles.indexOf(role)

/** How the file expresses direction and magnitude. */
export type AmountMode =
  | { kind: 'signed'; column: number; negativeMeans: TxType }
  | { kind: 'split'; outColumn: number; inColumn: number }
  | { kind: 'typed'; column: number; typeColumn: number }

/**
 * Whether an amount cell is written in major units (142.50) or already in the currency's
 * minor units (14250). Our own `exportCsv()` writes `amount_minor`, so re-importing it as
 * major units would be 100× off — detected from the header, never assumed.
 */
export type AmountUnit = 'major' | 'minor'

export type WalletTarget =
  | { kind: 'wallet'; walletId: string }
  // `walletId` is minted when the user chooses Create, so rows carry their final id from
  // the start and commit only has to materialise the wallet under it.
  | { kind: 'create'; walletId: string; name: string; currency: CurrencyCode }
  | { kind: 'skip' }

export type CategoryTarget =
  /** A root's id, or a child's when the value names a subcategory. */
  | { kind: 'category'; categoryId: string }
  // Rows bound to a category still to be made carry `pendingCategoryId(target)` until the
  // commit creates it and swaps in the id it got.
  | {
      kind: 'create'
      /** The category row the new one is created under; null for a new top-level one. */
      parentId: string | null
      name: string
      type: TxType
      /** Unique among the new category's siblings, minted when the user chose Create. */
      slug: string
    }
  | { kind: 'skip' }
  // Not a category at all: the rows are money moving between the user's own wallets, or a
  // correction to one wallet's balance. Neither is ever income or spending.
  | { kind: 'transfer' }
  | { kind: 'adjustment' }

/**
 * What a row is, beside its direction. Only `cashflow` is income or spending; a `transfer`
 * row is one side of money moving between two wallets, an `adjustment` a balance correction.
 */
export type RowIntent = 'cashflow' | 'transfer' | 'adjustment'

/**
 * What rows filed under a category the import will create carry until the commit makes it.
 * Sibling slugs are unique, so the parent and the slug name the create exactly.
 */
export const pendingCategoryId = (
  target: Pick<
    Extract<CategoryTarget, { kind: 'create' }>,
    'parentId' | 'slug'
  >,
): string => `new-category:${target.parentId ?? ''}:${target.slug}`

/**
 * A merchant binding also files the file's spelling as a new alias on that merchant, which
 * is what makes the next import from any source recognise it.
 */
export type MerchantTarget =
  | { kind: 'merchant'; merchantId: string }
  | { kind: 'create'; merchantId: string; displayName: string }
  | { kind: 'skip' }

/** Normalised file value → what it means here. Keys come from `matching.normalizeKey`. */
export type Aliases = {
  wallets: Record<string, WalletTarget>
  categories: Record<string, CategoryTarget>
  merchants: Record<string, MerchantTarget>
  types: Record<string, TxType>
  currencies: Record<string, CurrencyCode>
}

/**
 * Read one entry of a normalised-key table. A bare index would type a miss as a hit — the
 * project does not run `noUncheckedIndexedAccess` — and every caller here has to handle one.
 */
export const lookup = <T>(
  table: Readonly<Record<string, T>>,
  key: string,
): T | undefined => table[key]

export const emptyAliases = (): Aliases => ({
  wallets: {},
  categories: {},
  merchants: {},
  types: {},
  currencies: {},
})

export type MappingDefaults = {
  walletId: string | null
  currency: CurrencyCode
  type: TxType
  /**
   * Where a row the file files under nothing lands, by its direction: a category belongs to
   * one type, so money in and money out each need their own.
   */
  categoryIds: Record<TxType, string>
}

export type Mapping = {
  dialect: Dialect
  dateFormat: DateFormatToken | null
  /** True when the date column could be read two ways and the locale, not the file, chose. */
  dateAmbiguous: boolean
  roles: ColumnRole[]
  amount: AmountMode
  amountUnit: AmountUnit
  defaults: MappingDefaults
  aliases: Aliases
}

/**
 * Stamped into every saved `config` so a format change can tell the shapes apart — bump it
 * when a field's meaning changes, and teach `upgradeTemplateConfig` what the older number
 * means at the same time. 2: categories are named by id, not by slug pair.
 */
export const TEMPLATE_CONFIG_VERSION = 2

/**
 * The mapping a template remembers — everything the wizard would otherwise ask for, and
 * nothing transient (no file, no rows, no per-row corrections). It is an opaque JSON blob
 * on the wire and carries its own `version`, so its shape can evolve without a Dexie
 * migration and without a backend deploy.
 */
export type ImportTemplateConfig = {
  version: number
  dialect: Dialect
  dateFormat: DateFormatToken | null
  roles: ColumnRole[]
  amountKind: AmountMode['kind']
  /** Read only in `signed` mode: what a leading minus in the file means. */
  negativeMeans: TxType
  amountUnit: AmountUnit
  defaults: MappingDefaults
  aliases: Aliases
}

/** How a version-1 template named a category: its root's slug, plus a child's slug. */
export type CategoryPairV1 = { category: string; subcategory: string | null }

/**
 * A config saved before categories were referenced by id. Read, never written: applying
 * one upgrades it through the catalog (`upgradeTemplateConfig`).
 */
export type ImportTemplateConfigV1 = Omit<
  ImportTemplateConfig,
  'defaults' | 'aliases'
> & {
  defaults: Omit<MappingDefaults, 'categoryIds'> & CategoryPairV1
  aliases: Omit<Aliases, 'categories'> & {
    categories: Record<
      string,
      | ({ kind: 'category' } & CategoryPairV1)
      | ({ kind: 'create' } & CategoryPairV1)
      | Extract<CategoryTarget, { kind: 'skip' | 'transfer' | 'adjustment' }>
    >
  }
}

/** A config as the server hands it back: either shape, told apart by `version`. */
export type StoredTemplateConfig = ImportTemplateConfig | ImportTemplateConfigV1

export const isConfigV1 = (
  config: StoredTemplateConfig,
): config is ImportTemplateConfigV1 =>
  !(config.version >= TEMPLATE_CONFIG_VERSION)

// --- Row issues ----------------------------------------------------------------------

/**
 * The row-level vocabulary. Each code is also the key in `lib/errorMessages.ts`, so review
 * copy and API copy come from one place. File-level codes (`import.file.*`) are a separate
 * vocabulary owned by `csv/errors.ts`.
 */
export const ROW_ISSUES = {
  dateUnreadable: 'import.row.date_unreadable',
  dateAmbiguous: 'import.row.date_ambiguous',
  dateImplausible: 'import.row.date_implausible',
  amountUnreadable: 'import.row.amount_unreadable',
  amountAmbiguous: 'import.row.amount_ambiguous',
  amountMissing: 'import.row.amount_missing',
  amountZero: 'import.row.amount_zero',
  currencyUnsupported: 'import.row.currency_unsupported',
  currencyMismatch: 'import.row.currency_mismatch',
  walletUnresolved: 'import.row.wallet_unresolved',
  categoryDefaulted: 'import.row.category_defaulted',
  categoryTypeMismatch: 'import.row.category_type_mismatch',
  categoryMissing: 'import.row.category_missing',
  typeDefaulted: 'import.row.type_defaulted',
  ragged: 'import.row.ragged',
  transferUnpaired: 'import.row.transfer_unpaired',
  transferGuessed: 'import.row.transfer_guessed',
  transferSameWallet: 'import.row.transfer_same_wallet',
  transferCurrency: 'import.row.transfer_currency',
} as const

export type RowIssueCode = (typeof ROW_ISSUES)[keyof typeof ROW_ISSUES]

export type RowIssueField =
  | 'date'
  | 'amount'
  | 'currency'
  | 'wallet'
  | 'category'
  | 'type'
  | 'transfer'
  | 'row'

export type RowIssue = {
  level: 'warning' | 'error'
  field: RowIssueField
  code: RowIssueCode
  /** The offending cell, verbatim. */
  detail?: string
}

// --- Parsed rows ---------------------------------------------------------------------

/** Why an amount could not be read, or that it could. */
export type AmountState =
  | 'ok'
  | 'unreadable'
  | 'ambiguous'
  | 'missing'
  // The currency was unreadable, so the amount was never scaled — reporting it as an
  // unreadable amount would name the wrong cell.
  | 'skipped'

/** Everything one raw row says, before the rule table turns it into issues. */
export type RowFacts = {
  index: number
  line: number
  raw: string[]
  date: string | null
  dateCell: string
  /** Magnitude in minor units; direction lives in `type`. */
  amountMinor: number | null
  amountCell: string
  amountState: AmountState
  type: TxType
  typeDefaulted: boolean
  currency: CurrencyCode | null
  currencyCell: string
  walletId: string | null
  /** The wallet alias said "skip these rows" — the row leaves silently, as asked. */
  walletSkipped: boolean
  /** The leaf filed under — possibly a `pendingCategoryId` the commit resolves. */
  categoryId: string
  categoryDefaulted: boolean
  intent: RowIntent
  /** The other wallet of a transfer, when the user named it. */
  counterpartId: string | null
  merchantId: string | null
  merchantRaw: string | null
  note: string | null
  reference: string | null
  ragged: boolean
}

/** How a transfer row finds its other side. */
export type RowTransfer = {
  /** The file row holding the other side, when the file has one. */
  pairIndex: number | null
  /** The other wallet: the paired row's, the user's choice, or the one the note names. */
  counterpartId: string | null
  /** True when the note, not the file or the user, named the other wallet. */
  guessed: boolean
}

/** What a matched merchant says about a row's category. */
export type RowPrediction = {
  merchantId: string
  merchantName: string
  categoryId: string
  /** True ⇒ written into the draft (`auto_categorize` on). False ⇒ offered in review. */
  applied: boolean
}

export type ParsedRow = {
  /** 0-based data row. */
  index: number
  /** 1-based line in the file, for error copy. Approximate for embedded newlines. */
  line: number
  raw: string[]
  /**
   * Null when the row could not be read. Direction lives in `type` whatever the intent:
   * `spend` is money out of the wallet, `income` money into it.
   */
  draft: TransactionDraft | null
  intent: RowIntent
  /** Set exactly for a `transfer` row. */
  transfer: RowTransfer | null
  issues: RowIssue[]
  reference: string | null
  /** Excluded from the commit — by the user or by a skip mapping. */
  excluded: boolean
  prediction: RowPrediction | null
}

/** What the rule table needs to know beyond the row itself. */
export type RowContext = {
  /** Injected, never read from the clock — the pure layer is parameterised by it. */
  today: string
  /** Wallet currency by wallet id, for the mismatch warning. */
  walletCurrencies: Readonly<Record<string, CurrencyCode>>
  /** Wallet name by wallet id — what a transfer's note is read against. */
  walletNames: Readonly<Record<string, string>>
  /**
   * Each category's direction by id, the import's pending creates included — a row filed
   * under a category of the other type would be refused by the server.
   */
  categoryTypes: Readonly<Record<string, TxType>>
}

export const hasErrors = (issues: ReadonlyArray<RowIssue>): boolean =>
  issues.some((issue) => issue.level === 'error')
