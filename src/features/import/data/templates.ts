import { TEMPLATE_CONFIG_VERSION, isConfigV1, pendingCategoryId } from './types'
import { normalizeKey } from './matching'
import { formatRelativeTime } from '#/lib/date'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { LocalImportTemplate } from '#/db/types'
import type { TxType } from '#/features/transactions/api/types'
import type { MappingDraft } from './mapping'
import type {
  Aliases,
  CategoryPairV1,
  ColumnRole,
  ImportTemplateConfig,
  ImportTemplateConfigV1,
  MerchantTarget,
  StoredTemplateConfig,
  WalletTarget,
} from './types'

/**
 * Saved mappings: the header signature that recognises a file, turning the wizard's draft
 * into a stored config and back, and what to do when a stored config points at something
 * that is no longer there.
 *
 * Nothing here touches the database — it is the pure half of the template slice, so the
 * signature and the round trip are testable without Dexie or React.
 */

// --- The signature -------------------------------------------------------------------

/**
 * 32-bit FNV-1a as hex. Not cryptographic, and does not need to be: it only has to be
 * stable, cheap and synchronous. `crypto.subtle.digest` is async and would buy nothing.
 */
const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Bumping this retires every stored signature at once, rather than matching them wrongly. */
const SIGNATURE_ALGORITHM = 'csv1'

/**
 * A file's identity, as the *layout of its header row* — the one thing a bank's export
 * keeps from month to month while every cell in it changes.
 *
 * Each header is put through the import normaliser first, so the things that legitimately
 * vary between two exports of the same statement cannot move it: case, punctuation,
 * padding, a BOM, `Date ` versus `DATE`, diacritics. Columns whose header is empty after
 * that are dropped — a nameless trailing column is an artefact of a trailing delimiter,
 * present some months and not others, and it says nothing about the layout. What *does*
 * move it is the real signal: a different set of columns, or the same columns in a
 * different order. The delimiter rides along because it is what produced these headers in
 * the first place.
 */
export const signatureOf = (
  headers: ReadonlyArray<string>,
  delimiter: string,
): string => {
  const parts = headers
    .map((header) => normalizeKey(header))
    .filter((part) => part !== '')
  return `${SIGNATURE_ALGORITHM}:${fnv1a(`${parts.join('|')}#${delimiter}`)}`
}

// --- Draft ⇄ config ------------------------------------------------------------------

/** What the app currently holds, for checking a stored mapping still points at real things. */
export type TemplateCatalogue = {
  walletIds: ReadonlySet<string>
  /** The user's own categories — ids to check, and slugs to upgrade a version-1 config by. */
  categories: CategoryCatalog
  merchantIds: ReadonlySet<string>
}

/**
 * A target the user asked us to *create* has, by the time an import commits, been created —
 * so it is stored as the plain binding it became. A template that kept "create" would try
 * to resurrect a deleted account on every later import instead of asking.
 */
const settledWallet = (target: WalletTarget): WalletTarget =>
  target.kind === 'create'
    ? { kind: 'wallet', walletId: target.walletId }
    : target

const settledMerchant = (target: MerchantTarget): MerchantTarget =>
  target.kind === 'create'
    ? { kind: 'merchant', merchantId: target.merchantId }
    : target

const settledAliases = (aliases: Aliases): Aliases => ({
  wallets: Object.fromEntries(
    Object.entries(aliases.wallets).map(([key, t]) => [key, settledWallet(t)]),
  ),
  categories: { ...aliases.categories },
  merchants: Object.fromEntries(
    Object.entries(aliases.merchants).map(([key, t]) => [
      key,
      settledMerchant(t),
    ]),
  ),
  types: { ...aliases.types },
  currencies: { ...aliases.currencies },
})

/**
 * The session's mapping as the blob a template stores. A category to create keeps its
 * `create` target until the commit has made it — `withCreatedCategories` settles it then.
 */
export const configFromDraft = (draft: MappingDraft): ImportTemplateConfig => ({
  version: TEMPLATE_CONFIG_VERSION,
  dialect: { ...draft.dialect },
  dateFormat: draft.dateFormat,
  roles: [...draft.roles],
  amountKind: draft.amountKind,
  negativeMeans: draft.negativeMeans,
  amountUnit: draft.amountUnit,
  defaults: {
    ...draft.defaults,
    categoryIds: { ...draft.defaults.categoryIds },
  },
  aliases: settledAliases(draft.aliases),
})

/**
 * A created category only has its id once the commit has made it, so it is settled into a
 * plain binding afterwards, from the ids the commit hands back by pending id. One the commit
 * did not make is left out rather than stored as a promise.
 */
export const withCreatedCategories = (
  config: ImportTemplateConfig,
  created: ReadonlyMap<string, string>,
): ImportTemplateConfig => {
  const categories: Aliases['categories'] = {}
  for (const [key, target] of Object.entries(config.aliases.categories)) {
    if (target.kind !== 'create') {
      categories[key] = target
      continue
    }
    const id = created.get(pendingCategoryId(target))
    if (id !== undefined) categories[key] = { kind: 'category', categoryId: id }
  }
  return { ...config, aliases: { ...config.aliases, categories } }
}

/**
 * The config with every reference to category `fromId` pointing at `toId` instead, or the
 * same object when it names `fromId` nowhere. A version-1 config names no ids.
 */
export const remapTemplateCategoryIds = (
  config: StoredTemplateConfig,
  fromId: string,
  toId: string,
): StoredTemplateConfig => {
  if (isConfigV1(config)) return config
  const swap = (id: string): string => (id === fromId ? toId : id)
  const { spend, income } = config.defaults.categoryIds
  const bound = Object.values(config.aliases.categories).some(
    (target) => target.kind === 'category' && target.categoryId === fromId,
  )
  if (!bound && spend !== fromId && income !== fromId) return config
  const categories: Aliases['categories'] = {}
  for (const [key, target] of Object.entries(config.aliases.categories)) {
    categories[key] =
      target.kind === 'category'
        ? { kind: 'category', categoryId: swap(target.categoryId) }
        : target
  }
  return {
    ...config,
    defaults: {
      ...config.defaults,
      categoryIds: { spend: swap(spend), income: swap(income) },
    },
    aliases: { ...config.aliases, categories },
  }
}

// --- Version 1 -> 2 ------------------------------------------------------------------

const entryOfPair = (
  catalog: CategoryCatalog,
  pair: CategoryPairV1,
): { id: string; type: TxType } | null =>
  pair.subcategory
    ? catalog.bySlug(pair.subcategory, pair.category)
    : catalog.bySlug(pair.category)

export type UpgradedConfig = {
  config: ImportTemplateConfig
  /** Values a version-1 config answered with a slug pair this catalog has no category for. */
  dropped: string[]
}

/**
 * A version-1 config named categories by slug pair. Each pair is looked up in the user's
 * catalog and kept by id; a pair that matches nothing is dropped and reported, so step ③
 * asks again. The default becomes one per direction: the old one for its own type, the
 * catalog's fallback for the other.
 */
export const upgradeTemplateConfig = (
  stored: StoredTemplateConfig,
  catalog: CategoryCatalog,
): UpgradedConfig =>
  isConfigV1(stored)
    ? upgradeV1(stored, catalog)
    : { config: stored, dropped: [] }

const upgradeV1 = (
  v1: ImportTemplateConfigV1,
  catalog: CategoryCatalog,
): UpgradedConfig => {
  const categories: Aliases['categories'] = {}
  const dropped: string[] = []
  for (const [key, target] of Object.entries(v1.aliases.categories)) {
    if (target.kind !== 'category' && target.kind !== 'create') {
      categories[key] = target
      continue
    }
    const entry = entryOfPair(catalog, target)
    if (entry === null) dropped.push(key)
    else categories[key] = { kind: 'category', categoryId: entry.id }
  }

  const { category, subcategory, ...defaults } = v1.defaults
  const chosen = entryOfPair(catalog, { category, subcategory })
  const fallback = (type: TxType): string =>
    chosen?.type === type ? chosen.id : (catalog.fallbackFor(type)?.id ?? '')

  return {
    config: {
      ...v1,
      version: TEMPLATE_CONFIG_VERSION,
      defaults: {
        ...defaults,
        categoryIds: { spend: fallback('spend'), income: fallback('income') },
      },
      aliases: { ...v1.aliases, categories },
    },
    dropped,
  }
}

/** A value the template answers for, whose answer no longer exists here. */
export type UnknownAlias = {
  kind: 'wallet' | 'category' | 'merchant' | 'default'
  /**
   * The normalised spelling from the file, which is what the key is; for a `default`, which
   * one (`spend` / `income` / `wallet`).
   */
  key: string
  message: string
}

/** A saved role list read against a file of a different width, rather than silently mis-read. */
const alignRoles = (
  roles: ReadonlyArray<ColumnRole>,
  columnCount: number,
): ColumnRole[] =>
  Array.from(
    { length: columnCount },
    (_unused, index) => roles[index] ?? 'skip',
  )

const keep = <T>(
  entries: Readonly<Record<string, T>>,
  isKnown: (target: T) => boolean,
  describe: (key: string) => UnknownAlias,
): { kept: Record<string, T>; unknown: UnknownAlias[] } => {
  const kept: Record<string, T> = {}
  const unknown: UnknownAlias[] = []
  for (const [key, target] of Object.entries(entries)) {
    if (isKnown(target)) kept[key] = target
    else unknown.push(describe(key))
  }
  return { kept, unknown }
}

const quoted = (key: string): string => `“${key}”`

const FLOW_WORDS: Readonly<Record<TxType, string>> = {
  spend: 'money out',
  income: 'money in',
}

export type AppliedTemplate = {
  draft: MappingDraft
  /** Never swallowed: an answer we had to drop is re-asked, and the user is told why. */
  unknown: UnknownAlias[]
}

/**
 * Restore a stored mapping onto the file that is open. Everything the template answered is
 * restored; everything it answered *with something that is gone* is dropped and reported,
 * so step ③ asks again rather than a row resolving to a dangling id.
 */
export const applyTemplateConfig = (
  stored: StoredTemplateConfig,
  columnCount: number,
  catalogue: TemplateCatalogue,
): AppliedTemplate => {
  const catalog = catalogue.categories
  const { config, dropped } = upgradeTemplateConfig(stored, catalog)
  const wallets = keep(
    config.aliases.wallets,
    (target) =>
      target.kind !== 'wallet' || catalogue.walletIds.has(target.walletId),
    (key) => ({
      kind: 'wallet',
      key,
      message: `${quoted(key)} pointed at an account that no longer exists.`,
    }),
  )
  const categoryGone = (key: string): UnknownAlias => ({
    kind: 'category',
    key,
    message: `${quoted(key)} pointed at a category that no longer exists.`,
  })
  const categories = keep(
    config.aliases.categories,
    (target) =>
      target.kind === 'category'
        ? catalog.has(target.categoryId)
        : target.kind !== 'create',
    categoryGone,
  )
  const merchants = keep(
    config.aliases.merchants,
    (target) =>
      target.kind !== 'merchant' ||
      catalogue.merchantIds.has(target.merchantId),
    (key) => ({
      kind: 'merchant',
      key,
      message: `${quoted(key)} pointed at a merchant that no longer exists.`,
    }),
  )

  const defaultWalletId = config.defaults.walletId
  const defaultGone =
    defaultWalletId !== null && !catalogue.walletIds.has(defaultWalletId)

  const unknown = [
    ...wallets.unknown,
    ...dropped.map(categoryGone),
    ...categories.unknown,
    ...merchants.unknown,
  ]

  // A default that is gone, or no longer of its direction, falls to that type's fallback.
  const categoryIds = { ...config.defaults.categoryIds }
  for (const type of ['spend', 'income'] as const) {
    const id = categoryIds[type]
    if (catalog.has(id) && catalog.get(id).type === type) continue
    categoryIds[type] = catalog.fallbackFor(type)?.id ?? ''
    unknown.push({
      kind: 'default',
      key: type,
      message: `The category this template filed ${FLOW_WORDS[type]} under no longer exists.`,
    })
  }

  if (defaultGone) {
    unknown.push({
      kind: 'default',
      key: 'wallet',
      message:
        'The account this template filed unmatched rows into no longer exists.',
    })
  }

  return {
    draft: {
      dialect: { ...config.dialect },
      dateFormat: config.dateFormat,
      // The stored format *is* the user's earlier answer for this exact layout, so a
      // column that reads two ways is no longer ambiguous once a template pins it.
      dateAmbiguous: false,
      roles: alignRoles(config.roles, columnCount),
      amountKind: config.amountKind,
      negativeMeans: config.negativeMeans,
      amountUnit: config.amountUnit,
      defaults: {
        ...config.defaults,
        walletId: defaultGone ? null : defaultWalletId,
        categoryIds,
      },
      aliases: {
        wallets: wallets.kept,
        categories: categories.kept,
        merchants: merchants.kept,
        types: { ...config.aliases.types },
        currencies: { ...config.aliases.currencies },
      },
    },
    unknown,
  }
}

// --- The picker's list ---------------------------------------------------------------

/** The dialect fields that decide how the file is *parsed*, so changing one needs a re-read. */
export const needsReread = (
  saved: ImportTemplateConfig['dialect'],
  current: ImportTemplateConfig['dialect'],
): boolean =>
  saved.delimiter !== current.delimiter ||
  saved.quote !== current.quote ||
  saved.encoding !== current.encoding ||
  saved.skipRows !== current.skipRows ||
  saved.hasHeader !== current.hasHeader

export const usableTemplates = (
  templates: ReadonlyArray<LocalImportTemplate>,
): LocalImportTemplate[] => templates.filter((t) => t.deleted === 0)

/** Signature matches first, then most recently used — the two orders that save a scroll. */
export const rankTemplates = (
  templates: ReadonlyArray<LocalImportTemplate>,
  signature: string | null,
): LocalImportTemplate[] =>
  [...templates].sort((a, b) => {
    const matched =
      Number(b.signature === signature) - Number(a.signature === signature)
    if (matched !== 0) return matched
    return (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')
  })

/** One line under a saved mapping: why it cannot be used, or how well it is holding up. */
export const templateHint = (
  template: LocalImportTemplate,
  locale = 'en-US',
): string => {
  if (template.config === null) return 'needs rebuilding'
  if (template.nameConflict === 1) return 'rename to sync'
  if (template.useCount <= 0) return 'not used yet'
  const used =
    template.useCount === 1 ? 'used once' : `used ${template.useCount} times`
  const when =
    template.lastUsedAt === null
      ? null
      : formatRelativeTime(template.lastUsedAt, locale)
  return when === null ? used : `${used} · last ${when}`
}

/**
 * A first suggestion for a template's name, from the file it was built on. The trailing
 * period — `alrajhi-2026-08` — is dropped: next month's file is a different period and the
 * same template, so carrying the month into the name would make it read as stale at once.
 */
export const suggestTemplateName = (fileName: string): string => {
  const words = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
  while (words.length > 0 && /^\d+$/.test(words[words.length - 1])) words.pop()
  const name = words.join(' ')
  if (name === '') return 'My import'
  return name.charAt(0).toUpperCase() + name.slice(1)
}
