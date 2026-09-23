import { TEMPLATE_CONFIG_VERSION } from './types'
import { normalizeKey } from './matching'
import { formatRelativeTime } from '#/lib/date'
import type { LocalImportTemplate } from '#/db/types'
import type { MappingDraft } from './mapping'
import type {
  Aliases,
  CategoryTarget,
  ColumnRole,
  ImportTemplateConfig,
  MerchantTarget,
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
  /** `category|subcategory` pairs, exactly as a `CategoryTarget` names them. */
  categoryKeys: ReadonlySet<string>
  merchantIds: ReadonlySet<string>
}

export const categoryKeyOf = (
  category: string,
  subcategory: string | null,
): string => `${category}|${subcategory ?? ''}`

/**
 * A target the user asked us to *create* has, by the time an import commits, been created —
 * so it is stored as the plain binding it became. A template that kept "create" would try
 * to resurrect a deleted account on every later import instead of asking.
 */
const settledWallet = (target: WalletTarget): WalletTarget =>
  target.kind === 'create'
    ? { kind: 'wallet', walletId: target.walletId }
    : target

const settledCategory = (target: CategoryTarget): CategoryTarget =>
  target.kind === 'create'
    ? {
        kind: 'category',
        category: target.category,
        subcategory: target.subcategory,
      }
    : target

const settledMerchant = (target: MerchantTarget): MerchantTarget =>
  target.kind === 'create'
    ? { kind: 'merchant', merchantId: target.merchantId }
    : target

const settledAliases = (aliases: Aliases): Aliases => ({
  wallets: Object.fromEntries(
    Object.entries(aliases.wallets).map(([key, t]) => [key, settledWallet(t)]),
  ),
  categories: Object.fromEntries(
    Object.entries(aliases.categories).map(([key, t]) => [
      key,
      settledCategory(t),
    ]),
  ),
  merchants: Object.fromEntries(
    Object.entries(aliases.merchants).map(([key, t]) => [
      key,
      settledMerchant(t),
    ]),
  ),
  types: { ...aliases.types },
  currencies: { ...aliases.currencies },
})

/** The session's mapping as the blob a template stores. */
export const configFromDraft = (draft: MappingDraft): ImportTemplateConfig => ({
  version: TEMPLATE_CONFIG_VERSION,
  dialect: { ...draft.dialect },
  dateFormat: draft.dateFormat,
  roles: [...draft.roles],
  amountKind: draft.amountKind,
  negativeMeans: draft.negativeMeans,
  amountUnit: draft.amountUnit,
  defaults: { ...draft.defaults },
  aliases: settledAliases(draft.aliases),
  dedupe: { ...draft.dedupe },
})

/** A value the template answers for, whose answer no longer exists here. */
export type UnknownAlias = {
  kind: 'wallet' | 'category' | 'merchant' | 'default'
  /** The normalised spelling from the file, which is what the key is. */
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
  config: ImportTemplateConfig,
  columnCount: number,
  catalogue: TemplateCatalogue,
): AppliedTemplate => {
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
  const categories = keep(
    config.aliases.categories,
    (target) =>
      target.kind !== 'category' ||
      catalogue.categoryKeys.has(
        categoryKeyOf(target.category, target.subcategory),
      ),
    (key) => ({
      kind: 'category',
      key,
      message: `${quoted(key)} pointed at a category that no longer exists.`,
    }),
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
    ...categories.unknown,
    ...merchants.unknown,
  ]
  if (defaultGone) {
    unknown.push({
      kind: 'default',
      key: '',
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
      },
      aliases: {
        wallets: wallets.kept,
        categories: categories.kept,
        merchants: merchants.kept,
        types: { ...config.aliases.types },
        currencies: { ...config.aliases.currencies },
      },
      dedupe: { ...config.dedupe },
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
