import {
  distinctValues,
  matchCategory,
  matchCurrency,
  matchMerchant,
  matchType,
  normalizeKey,
  resolveWallet,
  tierFor,
} from './matching'
import { lookup } from './types'
import type { TxType } from '#/features/transactions/api/types'
import type { MerchantIndex } from '#/features/merchants/data/matching'
import type { CurrencyCode } from '#/lib/currency'
import type {
  CategoryOption,
  DistinctValue,
  MatchTier,
  WalletOption,
} from './matching'
import type {
  Aliases,
  CategoryTarget,
  MerchantTarget,
  WalletTarget,
} from './types'

/**
 * Step ③ as data: every distinct value a mapped column holds, what this app thinks it means,
 * and what the user has said it means. The answer is written into `mapping.aliases` keyed by
 * the normalised value — that dictionary is the entire contract between this step and the
 * rows, so nothing here holds state of its own.
 */

export type ValueKind = 'wallet' | 'category' | 'merchant' | 'type' | 'currency'

/** Radix forbids an empty item value, so every "not a real target" answer is a sentinel. */
export const UNSET = '__unset__'
export const SKIP = '__skip__'
export const CREATE = '__create__'
/** The pseudo-option standing for a target the user asked us to create at import time. */
export const NEW = '__new__'
/** Category answers that are not a category: money between wallets, a balance correction. */
export const TRANSFER = '__transfer__'
export const ADJUSTMENT = '__adjustment__'

/** What the two non-category answers read as, wherever a category select offers them. */
export const MOVEMENT_TARGETS: TargetGroup = {
  label: 'Not income or spending',
  options: [
    { value: TRANSFER, label: 'Transfer between wallets' },
    { value: ADJUSTMENT, label: 'Balance adjustment' },
  ],
}

export type TargetOption = {
  value: string
  label: string
  hint?: string | null
}

export type TargetGroup = { label: string | null; options: TargetOption[] }

export type ValueRow = {
  kind: ValueKind
  /** The normalised key this row writes under. Empty for the blank-cell row. */
  key: string
  /** The file's own spelling, verbatim. */
  raw: string
  count: number
  /** Cells that are empty never consult an alias — they take the step-② default. */
  blank: boolean
  /** What the select shows: a target, `NEW`, `SKIP` or `UNSET`. */
  value: string
  matched: boolean
  /** How good our proposal for this value was, whether or not it was taken. */
  tier: MatchTier
  /** True while the chosen target is still the one we proposed. */
  proposed: boolean
  /** Extra evidence under the row — a merchant's other spellings, why we could not choose. */
  hint: string | null
  /** True when we recognised the value but the target it names is a choice, not a fact. */
  ambiguous: boolean
  /** The target group the picker offers first, when the value named one. */
  preferGroup: string | null
  /** How a target that does not exist yet reads in the select. */
  newLabel: string | null
}

export type ValueGroup = {
  kind: ValueKind
  title: string
  rows: ValueRow[]
  found: number
  matched: number
  options: TargetGroup[]
}

export type ValueCatalogue = {
  wallets: ReadonlyArray<WalletOption>
  categories: ReadonlyArray<CategoryOption>
  merchants: MerchantIndex
}

export const categoryValue = (
  category: string,
  subcategory: string | null,
): string => `${category}|${subcategory ?? ''}`

export const splitCategoryValue = (
  value: string,
): { category: string; subcategory: string | null } => {
  const at = value.indexOf('|')
  const category = at < 0 ? value : value.slice(0, at)
  const subcategory = at < 0 ? '' : value.slice(at + 1)
  return { category, subcategory: subcategory === '' ? null : subcategory }
}

/**
 * The distinct members of a list of already-projected values. `distinctValues` covers a
 * plain column; a category that spells itself across two columns needs the pair.
 */
export const distinctOf = (values: ReadonlyArray<string>): DistinctValue[] => {
  const found = new Map<string, DistinctValue>()
  for (const value of values) {
    const raw = value.trim()
    const key = normalizeKey(raw)
    const seen = found.get(key)
    if (seen) seen.count += 1
    else found.set(key, { raw, key, count: 1 })
  }
  return [...found.values()].sort((a, b) => b.count - a.count)
}

// --- What we propose -----------------------------------------------------------------

/** Why we recognised a value but refuse to answer it — the user has to choose. */
export type Ambiguity = {
  /** One sentence under the row, naming what the value matched. */
  hint: string
  /** The target group to offer first in the picker, when the value named one. */
  group: string | null
}

export type Proposal = {
  value: string
  tier: MatchTier
  ambiguity: Ambiguity | null
}

const NONE: Proposal = { value: UNSET, tier: 'none', ambiguity: null }

const bound = (value: string, tier: MatchTier): Proposal => ({
  value,
  tier,
  ambiguity: null,
})

const ambiguous = (hint: string, group: string | null): Proposal => ({
  value: UNSET,
  tier: 'none',
  ambiguity: { hint, group },
})

const proposeWallet = (raw: string, catalogue: ValueCatalogue): Proposal => {
  const match = resolveWallet(raw, catalogue.wallets)
  if (match === null) return NONE
  if (match.kind === 'wallet') return bound(match.target.id, match.tier)
  return match.group === null
    ? ambiguous(
        `Matches ${match.wallets.length} accounts equally well — choose which one.`,
        null,
      )
    : ambiguous(
        `Matches the group “${match.group}” — choose which account.`,
        match.group,
      )
}

/**
 * The words an export uses for its own movements. The exact phrase is a sure answer; a value
 * that only contains one ("Bank transfer fee") is offered but flagged for a look.
 */
const MOVEMENT_WORDS: ReadonlyArray<{
  value: string
  pattern: RegExp
  exact: ReadonlyArray<string>
}> = [
  {
    value: TRANSFER,
    pattern: /transfer/i,
    exact: ['transfer', 'transfers', 'transfer between wallets'],
  },
  {
    value: ADJUSTMENT,
    pattern: /adjust/i,
    exact: [
      'adjustment',
      'balance adjustment',
      'adjust balance',
      'adjusted balance',
    ],
  },
]

const proposeMovement = (raw: string): Proposal | null => {
  const word = MOVEMENT_WORDS.find((entry) => entry.pattern.test(raw))
  if (word === undefined) return null
  return bound(
    word.value,
    word.exact.includes(normalizeKey(raw)) ? 'auto' : 'check',
  )
}

const proposeCategory = (raw: string, catalogue: ValueCatalogue): Proposal => {
  const movement = proposeMovement(raw)
  if (movement !== null) return movement
  const match = matchCategory(raw, catalogue.categories)
  return match === null
    ? NONE
    : bound(
        categoryValue(match.target.category, match.target.subcategory),
        match.tier,
      )
}

const proposeMerchant = (raw: string, catalogue: ValueCatalogue): Proposal => {
  const match = matchMerchant(raw, catalogue.merchants)
  if (match === null) return NONE
  const tier = tierFor(match.score)
  return tier === 'none' ? NONE : bound(match.merchant.id, tier)
}

const proposeType = (raw: string): Proposal => {
  const type = matchType(raw)
  return type === null ? NONE : bound(type, 'auto')
}

const proposeCurrency = (raw: string): Proposal => {
  const code = matchCurrency(raw)
  return code === null ? NONE : bound(code, 'auto')
}

/** Our best reading of one file value, scored on the shared ladder. */
export const proposalFor = (
  kind: ValueKind,
  raw: string,
  catalogue: ValueCatalogue,
): Proposal => {
  switch (kind) {
    case 'wallet':
      return proposeWallet(raw, catalogue)
    case 'category':
      return proposeCategory(raw, catalogue)
    case 'merchant':
      return proposeMerchant(raw, catalogue)
    case 'type':
      return proposeType(raw)
    default:
      return proposeCurrency(raw)
  }
}

/** Our reading of a kind's distinct values, under the key each one writes its answer under. */
export type Proposals = ReadonlyMap<string, Proposal>

/**
 * What we make of one kind's values, worked out once. A proposal is a function of the file
 * and the catalogue alone — **never** of what the user has answered — so every answer given
 * on this screen re-reads this rather than re-running the matcher over every value.
 *
 * The blank value is left out: an empty cell takes the step-② default and is never matched.
 */
export const proposalsFor = (
  kind: ValueKind,
  values: ReadonlyArray<DistinctValue>,
  catalogue: ValueCatalogue,
): Proposals =>
  new Map(
    values
      .filter((value) => value.key !== '')
      .map((value) => [value.key, proposalFor(kind, value.raw, catalogue)]),
  )

// --- What the mapping already says ----------------------------------------------------

const walletValue = (target: WalletTarget | undefined): string => {
  if (target === undefined) return UNSET
  if (target.kind === 'skip') return SKIP
  return target.kind === 'create' ? NEW : target.walletId
}

const categoryTargetValue = (target: CategoryTarget | undefined): string => {
  if (target === undefined) return UNSET
  switch (target.kind) {
    case 'skip':
      return SKIP
    case 'transfer':
      return TRANSFER
    case 'adjustment':
      return ADJUSTMENT
    case 'create':
      return NEW
    default:
      return categoryValue(target.category, target.subcategory)
  }
}

const categoryTargetOf = (value: string): CategoryTarget => {
  if (value === SKIP) return { kind: 'skip' }
  if (value === TRANSFER) return { kind: 'transfer' }
  if (value === ADJUSTMENT) return { kind: 'adjustment' }
  return { kind: 'category', ...splitCategoryValue(value) }
}

const merchantValue = (target: MerchantTarget | undefined): string => {
  if (target === undefined) return UNSET
  if (target.kind === 'skip') return SKIP
  return target.kind === 'create' ? NEW : target.merchantId
}

export const chosenValue = (
  kind: ValueKind,
  key: string,
  aliases: Aliases,
): string => {
  switch (kind) {
    case 'wallet':
      return walletValue(lookup(aliases.wallets, key))
    case 'category':
      return categoryTargetValue(lookup(aliases.categories, key))
    case 'merchant':
      return merchantValue(lookup(aliases.merchants, key))
    case 'type':
      return lookup(aliases.types, key) ?? UNSET
    default:
      return lookup(aliases.currencies, key) ?? UNSET
  }
}

// --- Rows ------------------------------------------------------------------------------

const RANK: Readonly<Record<string, number>> = {
  unmatched: 0,
  check: 1,
  matched: 2,
  blank: 3,
}

const rankOf = (row: ValueRow): number => {
  if (row.blank) return RANK.blank
  if (!row.matched) return RANK.unmatched
  return row.proposed && row.tier === 'check' ? RANK.check : RANK.matched
}

export type RowNotes = { hint: string | null; newLabel: string | null }

/** What a chosen target reads as — supplied by the hook, which holds the catalogues. */
export type NoteReader = (
  kind: ValueKind,
  key: string,
  value: string,
) => RowNotes

const NO_NOTES: RowNotes = { hint: null, newLabel: null }

/**
 * One group's rows: what is in the file, what it maps to, and how sure we were. Anything
 * still unanswered sorts to the top, because that is the only work left on this screen.
 */
export const valueRows = (
  kind: ValueKind,
  values: ReadonlyArray<DistinctValue>,
  aliases: Aliases,
  proposals: Proposals,
  describe: NoteReader = () => NO_NOTES,
): ValueRow[] => {
  const rows = values.map((value): ValueRow => {
    const blank = value.key === ''
    const chosen = chosenValue(kind, value.key, aliases)
    const proposal = proposals.get(value.key) ?? NONE
    const matched = chosen !== UNSET
    const notes = matched ? describe(kind, value.key, chosen) : NO_NOTES
    // A choice the user has made settles the ambiguity; only an open one is worth saying.
    const ambiguity = matched ? null : proposal.ambiguity
    return {
      kind,
      key: value.key,
      raw: value.raw,
      count: value.count,
      blank,
      value: chosen,
      matched,
      tier: proposal.tier,
      proposed: matched && chosen === proposal.value,
      hint: notes.hint ?? ambiguity?.hint ?? null,
      ambiguous: ambiguity !== null,
      preferGroup: ambiguity?.group ?? null,
      newLabel: notes.newLabel,
    }
  })
  return rows.sort(
    (a, b) =>
      rankOf(a) - rankOf(b) || b.count - a.count || (a.raw < b.raw ? -1 : 1),
  )
}

/**
 * The high-confidence answers, ready to be written into the aliases. Values the user has
 * already answered are never revisited — re-running the matcher must not undo a choice.
 */
export const seedFor = (
  kind: ValueKind,
  values: ReadonlyArray<DistinctValue>,
  aliases: Aliases,
  proposals: Proposals,
  overwrite = false,
): Array<{ key: string; value: string }> => {
  const seeds: Array<{ key: string; value: string }> = []
  for (const value of values) {
    if (value.key === '') continue
    if (!overwrite && chosenValue(kind, value.key, aliases) !== UNSET) continue
    const proposal = proposals.get(value.key)
    if (proposal === undefined || proposal.tier === 'none') continue
    seeds.push({ key: value.key, value: proposal.value })
  }
  return seeds
}

// --- Writing an answer back ------------------------------------------------------------

export type TargetTable =
  | { kind: 'wallet'; table: Record<string, WalletTarget> }
  | { kind: 'category'; table: Record<string, CategoryTarget> }
  | { kind: 'merchant'; table: Record<string, MerchantTarget> }
  | { kind: 'type'; table: Record<string, TxType> }
  | { kind: 'currency'; table: Record<string, CurrencyCode> }

const withoutKey = <T>(
  table: Readonly<Record<string, T>>,
  key: string,
): Record<string, T> => {
  const { [key]: _dropped, ...rest } = table
  return rest
}

/**
 * Apply one answer to the alias dictionary. `UNSET` removes the entry — an unanswered value
 * and a value answered "nothing" are different things, and only the second is a decision.
 */
export const withAlias = (
  aliases: Aliases,
  kind: ValueKind,
  key: string,
  value: string,
): Aliases => {
  if (kind === 'type') {
    return {
      ...aliases,
      types:
        value === UNSET
          ? withoutKey(aliases.types, key)
          : { ...aliases.types, [key]: value as TxType },
    }
  }
  if (kind === 'currency') {
    return {
      ...aliases,
      currencies:
        value === UNSET
          ? withoutKey(aliases.currencies, key)
          : { ...aliases.currencies, [key]: value },
    }
  }
  if (kind === 'wallet') {
    const target: WalletTarget | null =
      value === SKIP ? { kind: 'skip' } : { kind: 'wallet', walletId: value }
    return {
      ...aliases,
      wallets:
        value === UNSET
          ? withoutKey(aliases.wallets, key)
          : { ...aliases.wallets, [key]: target },
    }
  }
  if (kind === 'category') {
    return {
      ...aliases,
      categories:
        value === UNSET
          ? withoutKey(aliases.categories, key)
          : { ...aliases.categories, [key]: categoryTargetOf(value) },
    }
  }
  const target: MerchantTarget =
    value === SKIP ? { kind: 'skip' } : { kind: 'merchant', merchantId: value }
  return {
    ...aliases,
    merchants:
      value === UNSET
        ? withoutKey(aliases.merchants, key)
        : { ...aliases.merchants, [key]: target },
  }
}

/**
 * Record a target the user asked us to invent. It already carries the id or slug it will be
 * created under, so every row bound to it is final before anything is written.
 */
export const withNewWallet = (
  aliases: Aliases,
  key: string,
  target: WalletTarget,
): Aliases => ({ ...aliases, wallets: { ...aliases.wallets, [key]: target } })

export const withNewCategory = (
  aliases: Aliases,
  key: string,
  target: CategoryTarget,
): Aliases => ({
  ...aliases,
  categories: { ...aliases.categories, [key]: target },
})

export const withNewMerchant = (
  aliases: Aliases,
  key: string,
  target: MerchantTarget,
): Aliases => ({
  ...aliases,
  merchants: { ...aliases.merchants, [key]: target },
})

/** Write a whole batch of answers at once — the auto-match pass and *Skip merchants*. */
export const withAliases = (
  aliases: Aliases,
  kind: ValueKind,
  entries: ReadonlyArray<{ key: string; value: string }>,
): Aliases =>
  entries.reduce(
    (current, entry) => withAlias(current, kind, entry.key, entry.value),
    aliases,
  )

/**
 * The named group's accounts first. An ambiguous value almost always means one of them, and
 * a bank with twenty accounts should not make the user hunt for the right three.
 */
export const preferredFirst = (
  options: ReadonlyArray<TargetGroup>,
  group: string | null,
): ReadonlyArray<TargetGroup> => {
  if (group === null) return options
  const at = options.findIndex((entry) => entry.label === group)
  return at <= 0
    ? options
    : [options[at], ...options.filter((_, index) => index !== at)]
}

export { distinctValues }
