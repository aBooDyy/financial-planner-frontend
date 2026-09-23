import {
  AUTO_MATCH_SCORE,
  CHECK_MATCH_SCORE,
  matchMerchant,
  scoreKeys,
} from '#/features/merchants/data/matching'
import { currencyList } from '#/lib/config/appConfig'
import { isSupportedCurrency } from '#/lib/currency'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyMeta } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'

/**
 * Matching a file's own words to the things this app knows about: accounts, categories,
 * types and currencies. Merchants are **not** re-implemented here — the merchants slice owns
 * that ladder and is re-exported at the bottom.
 */

const COMBINING = /\p{M}+/gu
// U+0640 ARABIC TATWEEL: a decorative stretch inside a word, never part of its identity.
const TATWEEL = new RegExp('\u0640', 'g')
const NON_ALNUM = /[^\p{L}\p{N}]+/gu

/**
 * The import normaliser: NFKD · drop combining marks (which also folds Arabic tashkeel and
 * the hamza forms of alef) · lowercase · every non-alphanumeric run becomes one space.
 *
 * **Not** the merchant normaliser. `merchants/data/matching.normalizeKey` is pinned
 * byte-for-byte to the backend's fixture, keeps ASCII only and folds no diacritics; this one
 * is local to the client and keeps letters of every script, so an Arabic account name still
 * has a key. Digits survive both: `current 4471` and `current 9902` are two accounts and
 * must never collapse into one.
 */
export const normalizeKey = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(COMBINING, '')
    .replace(TATWEEL, '')
    .toLowerCase()
    .replace(NON_ALNUM, ' ')
    .trim()

/** How a proposed match is presented: applied, pre-selected but flagged, or not offered. */
export type MatchTier = 'auto' | 'check' | 'none'

export const tierFor = (score: number): MatchTier => {
  if (score >= AUTO_MATCH_SCORE) return 'auto'
  if (score >= CHECK_MATCH_SCORE) return 'check'
  return 'none'
}

export type Scored<T> = { target: T; score: number; tier: MatchTier }

type Candidate<T> = { target: T; keys: ReadonlyArray<string> }

const SPACES = / /g

/**
 * The shared ladder plus one import-only rung at the top: two keys that differ only in
 * spacing are the same name. A bank writes `ALBILAD` where a person writes `Al Bilad`, and
 * calling that an exact hit is narrower than loosening any threshold would be.
 */
const scoreKey = (key: string, candidateKey: string): number => {
  const score = scoreKeys(key, candidateKey)
  if (score === 100 || candidateKey === '') return score
  return key.replace(SPACES, '') === candidateKey.replace(SPACES, '')
    ? 100
    : score
}

/**
 * Every candidate tying for the best score. Ties are returned rather than resolved: picking
 * the first of two equal candidates binds money to an account nobody chose.
 *
 * The ladder itself lives in the merchants slice so all four value kinds score alike: exact
 * normalised equality 100 · whole-token containment 70 · Jaccard token overlap 40–69 ·
 * Levenshtein ≥ 0.82 on short strings 60.
 */
const topCandidates = <T>(
  raw: string,
  candidates: ReadonlyArray<Candidate<T>>,
): { targets: T[]; score: number } | null => {
  const key = normalizeKey(raw)
  if (key === '') return null
  let score = 0
  let targets: T[] = []
  for (const candidate of candidates) {
    let best = 0
    for (const candidateKey of candidate.keys) {
      best = Math.max(best, scoreKey(key, normalizeKey(candidateKey)))
    }
    if (best === 0 || best < score) continue
    if (best > score) {
      score = best
      targets = [candidate.target]
    } else {
      targets.push(candidate.target)
    }
  }
  return score === 0 ? null : { targets, score }
}

/** The one candidate that wins outright, or nothing — a tie is a question, not an answer. */
const bestCandidate = <T>(
  raw: string,
  candidates: ReadonlyArray<Candidate<T>>,
): Scored<T> | null => {
  const top = topCandidates(raw, candidates)
  if (top === null || top.targets.length > 1) return null
  const tier = tierFor(top.score)
  return tier === 'none'
    ? null
    : { target: top.targets[0], score: top.score, tier }
}

// --- Wallets -------------------------------------------------------------------------

export type WalletOption = {
  id: string
  name: string
  currency: CurrencyCode | null
  /** The group path the wallet sits in ("Cards › Visa"), when it has one. */
  group?: string | null
}

/** Flatten `walletGroupOptions()` into the candidate list the matcher scores. */
export const walletOptionsFrom = (
  groups: ReadonlyArray<{
    label: string | null
    wallets: ReadonlyArray<{ id: string; name: string }>
  }>,
  currencyOf: (id: string) => CurrencyCode | null = () => null,
): WalletOption[] =>
  groups.flatMap((group) =>
    group.wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      currency: currencyOf(wallet.id),
      group: group.label,
    })),
  )

/**
 * What a file value can name: one wallet, or the group a set of wallets sits in. A statement
 * that says "Al Bilad" is naming the bank, which here is the group — the wallet inside it is
 * called something else entirely.
 */
type WalletSignal = { group: string | null; wallets: WalletOption[] }

const walletSignals = (
  wallets: ReadonlyArray<WalletOption>,
): Candidate<WalletSignal>[] => {
  const byGroup = new Map<string, WalletOption[]>()
  const signals = wallets.map((wallet): Candidate<WalletSignal> => {
    const group = wallet.group ?? ''
    if (group !== '') {
      const members = byGroup.get(group)
      if (members) members.push(wallet)
      else byGroup.set(group, [wallet])
    }
    return {
      target: { group: null, wallets: [wallet] },
      keys:
        group === '' ? [wallet.name] : [wallet.name, `${group} ${wallet.name}`],
    }
  })
  for (const [group, members] of byGroup) {
    signals.push({ target: { group, wallets: members }, keys: [group] })
  }
  return signals
}

export type WalletResolution =
  | ({ kind: 'wallet' } & Scored<WalletOption>)
  | {
      kind: 'ambiguous'
      /** The group the value named, when one group alone explains the match. */
      group: string | null
      /** The accounts it could mean, in catalogue order. */
      wallets: WalletOption[]
      score: number
    }

/**
 * The whole story about one file value: the account it means, the choice it narrows things
 * to, or nothing. A value that lands on a group holding several accounts is ambiguous by
 * construction and is never bound — the group is what the file named, not the account.
 */
export const resolveWallet = (
  raw: string,
  wallets: ReadonlyArray<WalletOption>,
): WalletResolution | null => {
  const top = topCandidates(raw, walletSignals(wallets))
  if (top === null) return null
  const tier = tierFor(top.score)
  if (tier === 'none') return null

  const found = new Map<string, WalletOption>()
  for (const signal of top.targets) {
    for (const wallet of signal.wallets) found.set(wallet.id, wallet)
  }
  const candidates = [...found.values()]
  if (candidates.length === 1) {
    return { kind: 'wallet', target: candidates[0], score: top.score, tier }
  }
  const groups = new Set(
    top.targets
      .map((signal) => signal.group)
      .filter((group): group is string => group !== null),
  )
  return {
    kind: 'ambiguous',
    group: groups.size === 1 ? [...groups][0] : null,
    wallets: candidates,
    score: top.score,
  }
}

/** The account a value binds to outright. Ambiguity reads as no match here. */
export const matchWallet = (
  raw: string,
  wallets: ReadonlyArray<WalletOption>,
): Scored<WalletOption> | null => {
  const resolved = resolveWallet(raw, wallets)
  return resolved !== null && resolved.kind === 'wallet' ? resolved : null
}

// --- Categories ----------------------------------------------------------------------

export type CategoryOption = {
  /** Parent slug — what a transaction stores. */
  category: string
  subcategory: string | null
  name: string
  type: TxType
}

/**
 * Every category a row may be filed under, flattened out of the user's own catalog: each
 * parent, then each of its children as the pair a transaction stores.
 */
export const categoryOptions = (catalog: CategoryCatalog): CategoryOption[] =>
  catalog.all.flatMap((category) => [
    {
      category: category.slug,
      subcategory: null,
      name: category.name,
      type: category.type,
    },
    ...category.subs.map((sub) => ({
      category: category.slug,
      subcategory: sub.slug,
      name: sub.name,
      type: category.type,
    })),
  ])

const categoryKeys = (
  option: CategoryOption,
  parentName: (slug: string) => string | undefined,
): string[] => {
  if (option.subcategory === null) return [option.name]
  const parent = parentName(option.category)
  return parent ? [option.name, `${parent} ${option.name}`] : [option.name]
}

export const matchCategory = (
  raw: string,
  options: ReadonlyArray<CategoryOption>,
): Scored<CategoryOption> | null => {
  const parents = new Map(
    options
      .filter((option) => option.subcategory === null)
      .map((option) => [option.category, option.name]),
  )
  return bestCandidate(
    raw,
    options.map((option) => ({
      target: option,
      keys: categoryKeys(option, (slug) => parents.get(slug)),
    })),
  )
}

// --- Types ---------------------------------------------------------------------------

const TYPE_WORDS: ReadonlyArray<readonly [TxType, ReadonlyArray<string>]> = [
  [
    'spend',
    [
      'dr',
      'debit',
      'debits',
      'withdrawal',
      'withdrawn',
      'payment',
      'paid out',
      'money out',
      'out',
      'outgoing',
      'purchase',
      'spend',
      'spent',
      'expense',
      'charge',
      'مدين',
      'سحب',
      'شراء',
      'مدفوعات',
      'خصم',
      'صادر',
    ],
  ],
  [
    'income',
    [
      'cr',
      'credit',
      'credits',
      'deposit',
      'refund',
      'paid in',
      'money in',
      'in',
      'incoming',
      'salary',
      'income',
      'received',
      'receipt',
      'دائن',
      'ايداع',
      'إيداع',
      'راتب',
      'استرداد',
      'وارد',
    ],
  ],
]

/** Normalised word → direction. The seed dictionary; anything else asks. */
export const TYPE_ALIASES: Readonly<Record<string, TxType>> =
  Object.fromEntries(
    TYPE_WORDS.flatMap(([type, words]) =>
      words.map((word) => [normalizeKey(word), type] as const),
    ),
  )

export const matchType = (raw: string): TxType | null =>
  TYPE_ALIASES[normalizeKey(raw)] ?? null

// --- Currencies ----------------------------------------------------------------------

type CurrencyIndex = {
  byName: Map<string, CurrencyCode>
  /** Only symbols that belong to exactly one currency — `$` belongs to twelve. */
  bySymbol: Map<string, CurrencyCode>
}

let indexedTable: ReadonlyArray<CurrencyMeta> | null = null
let currencyIndex: CurrencyIndex = { byName: new Map(), bySymbol: new Map() }

const buildCurrencyIndex = (
  table: ReadonlyArray<CurrencyMeta>,
): CurrencyIndex => {
  const byName = new Map<string, CurrencyCode>()
  const symbolOwners = new Map<string, CurrencyCode[]>()
  for (const meta of table) {
    byName.set(normalizeKey(meta.name), meta.code)
    const owners = symbolOwners.get(meta.symbol)
    if (owners) owners.push(meta.code)
    else symbolOwners.set(meta.symbol, [meta.code])
  }
  const bySymbol = new Map<string, CurrencyCode>()
  for (const [symbol, owners] of symbolOwners) {
    if (owners.length === 1) bySymbol.set(symbol, owners[0])
  }
  return { byName, bySymbol }
}

const indexOfCurrencies = (): CurrencyIndex => {
  const table = currencyList()
  if (table !== indexedTable) {
    indexedTable = table
    currencyIndex = buildCurrencyIndex(table)
  }
  return currencyIndex
}

/**
 * A file's own spelling of a currency → an ISO code. An ISO code or a full name binds; a
 * symbol binds only when one currency owns it, because guessing between `$` and `$` would
 * mis-scale money silently. Anything else is left for the user to bind once.
 */
export const matchCurrency = (raw: string): CurrencyCode | null => {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const upper = trimmed.toUpperCase()
  if (isSupportedCurrency(upper)) return upper
  const index = indexOfCurrencies()
  return (
    index.byName.get(normalizeKey(trimmed)) ??
    index.bySymbol.get(trimmed) ??
    null
  )
}

// --- Distinct values -----------------------------------------------------------------

export type DistinctValue = {
  /** The file's own spelling, verbatim — what the value step shows. */
  raw: string
  key: string
  count: number
}

/**
 * The distinct values of one column with their row counts, most frequent first. Matching
 * runs over these, not over rows: a 50 000-row statement holds a few dozen account names.
 */
export const distinctValues = (
  rows: ReadonlyArray<ReadonlyArray<string>>,
  column: number,
): DistinctValue[] => {
  const found = new Map<string, DistinctValue>()
  for (const row of rows) {
    const raw = (row[column] ?? '').trim()
    const key = normalizeKey(raw)
    const seen = found.get(key)
    if (seen) seen.count += 1
    else found.set(key, { raw, key, count: 1 })
  }
  return [...found.values()].sort((a, b) => b.count - a.count)
}

// Merchants keep their own normaliser and their own matcher; `predict.ts` reaches for the
// prediction wrapper directly, where `auto_categorize` is read.
export { AUTO_MATCH_SCORE, CHECK_MATCH_SCORE, matchMerchant, scoreKeys }
