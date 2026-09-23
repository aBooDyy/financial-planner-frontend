import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import { NODE_COLORS } from '#/features/balances/constants'
import { createNodeWithId } from '#/features/balances/data/mutations'
import {
  addMerchantAlias,
  createMerchantWithId,
  isUsableAlias,
} from '#/features/merchants/data/mutations'
import { createCategoryWithSlug } from '#/features/categories/data/mutations'
import { bulkAddTransactions } from '#/features/transactions/data/mutations'
import { batchSource, saveBatch } from './batches'
import { normalizeKey } from './matching'
import { isCommittable } from './review'
import { roleColumn } from './types'
import type { LocalImportBatch } from '#/db/types'
import type { TransactionDraft } from '#/features/transactions/data/mutations'
import type { Aliases, Mapping, ParsedRow } from './types'

/**
 * The commit — the first and only moment an import writes anything.
 *
 * Everything is local: rows and their outbox entries land in Dexie, and a single
 * `schedulePush()` at the end lets the sync engine drain them whenever the network is
 * there. An import committed on a plane is a correct ledger on a plane.
 */

export const CHUNK_SIZE = 200

/** A wallet and a category created by an import wear the palette's first colour. */
const NEW_ENTITY_COLOR = NODE_COLORS[0]

export type CommitMeta = {
  /** The file's name, which is what the history strip lists. */
  label: string
  templateId: string | null
  /** Rows the file held, against the rows actually written. */
  rowCount: number
  skippedDuplicates: number
  errorCount: number
}

export type CommitProgress = (done: number, total: number) => void

/**
 * The rows to write, read in chunks rather than handed over as one array. A 50 000-row
 * import is 50 000 rows on disk either way; it does not have to be 50 000 objects in memory
 * first, and the review step no longer holds them.
 */
export type CommitSource = {
  total: number
  /** The raw cells of the committable row at `at` — read without building a row. */
  cellsAt: (at: number) => ReadonlyArray<string>
  /** The committable rows in [start, end), built only as the commit reaches them. */
  rowsAt: (start: number, end: number) => ReadonlyArray<ParsedRow>
}

/** A source over rows a caller already holds. */
export const rowsSource = (rows: ReadonlyArray<ParsedRow>): CommitSource => {
  const committable = rows.filter(isCommittable)
  return {
    total: committable.length,
    cellsAt: (at) => committable[at].raw,
    rowsAt: (start, end) => committable.slice(start, end),
  }
}

export type CommitResult = {
  batch: LocalImportBatch
  /** New spellings filed onto existing merchants — what the Done screen reports. */
  learnedSpellings: number
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * The file's own spelling for each merchant key, recovered from the rows. Aliases are keyed
 * by the normalised value, and `rows.ts` looks them up under exactly this key, so this is
 * the same dictionary read backwards.
 */
const merchantSpellings = (
  source: CommitSource,
  mapping: Mapping,
): Map<string, string> => {
  const spellings = new Map<string, string>()
  const column = roleColumn(mapping.roles, 'merchant')
  if (column < 0) return spellings
  for (let at = 0; at < source.total; at += 1) {
    const cell = (source.cellsAt(at)[column] ?? '').trim()
    if (cell === '') continue
    const key = normalizeKey(cell)
    if (!spellings.has(key)) spellings.set(key, cell)
  }
  return spellings
}

/**
 * Materialise everything the mapping promised to create, under the exact id or slug the
 * rows already carry. It runs before any row is written, so a failure here leaves nothing
 * imported. Returns the merchant ids it could not create — their rows lose the link rather
 * than pointing at an account that does not exist.
 */
async function createPendingTargets(
  aliases: Aliases,
  spellings: ReadonlyMap<string, string>,
): Promise<Set<string>> {
  const unresolved = new Set<string>()

  for (const target of Object.values(aliases.wallets)) {
    if (target.kind !== 'create') continue
    await createNodeWithId(target.walletId, {
      kind: 'wallet',
      name: target.name,
      color: NEW_ENTITY_COLOR,
      note: null,
      parentId: null,
      amount: 0,
      currency: target.currency,
    })
  }

  for (const target of Object.values(aliases.categories)) {
    if (target.kind !== 'create') continue
    // A child carries the pair: its parent's slug in `category`, its own in `subcategory`.
    // A blank colour there means "inherit the parent's", which is what the server stores.
    await createCategoryWithSlug(target.subcategory ?? target.category, {
      name: target.name,
      type: target.type,
      color: target.parentId === null ? NEW_ENTITY_COLOR : '',
      parentId: target.parentId,
    })
  }

  for (const [key, target] of Object.entries(aliases.merchants)) {
    if (target.kind !== 'create') continue
    const spelling = spellings.get(key)
    const extra =
      spelling !== undefined &&
      spelling !== target.displayName &&
      isUsableAlias(spelling)
        ? [{ raw: spelling, origin: 'import' as const }]
        : []
    if (!isUsableAlias(target.displayName) && extra.length === 0) {
      unresolved.add(target.merchantId)
      continue
    }
    await createMerchantWithId(target.merchantId, {
      displayName: target.displayName,
      aliases: extra,
    })
  }

  return unresolved
}

/**
 * File the file's spelling onto each merchant the user bound a value to — the step that
 * makes the next import, from any source, recognise the same counterparty. A spelling that
 * normalises to nothing (an Arabic-only name) is skipped rather than sent.
 */
async function learnSpellings(
  aliases: Aliases,
  spellings: ReadonlyMap<string, string>,
): Promise<number> {
  const before = await db.merchantAliases.count()
  for (const [key, target] of Object.entries(aliases.merchants)) {
    if (target.kind !== 'merchant') continue
    const raw = spellings.get(key)
    if (raw === undefined || !isUsableAlias(raw)) continue
    await addMerchantAlias(target.merchantId, raw, 'import')
  }
  return (await db.merchantAliases.count()) - before
}

export async function commitImport(
  rows: CommitSource,
  mapping: Mapping,
  meta: CommitMeta,
  onProgress?: CommitProgress,
): Promise<CommitResult> {
  const batchId = crypto.randomUUID()
  const source = batchSource(batchId)
  const spellings = merchantSpellings(rows, mapping)

  const unresolved = await createPendingTargets(mapping.aliases, spellings)
  const learnedSpellings = await learnSpellings(mapping.aliases, spellings)

  const total = rows.total
  const walletIds = new Set<string>()
  let imported = 0
  onProgress?.(0, total)

  for (let at = 0; at < total; at += CHUNK_SIZE) {
    const chunk = rows.rowsAt(at, Math.min(at + CHUNK_SIZE, total))
    const entries = chunk.map((row) => {
      const draft = row.draft as TransactionDraft
      walletIds.add(draft.walletId)
      return {
        id: crypto.randomUUID(),
        draft: {
          ...draft,
          merchantId:
            draft.merchantId != null && unresolved.has(draft.merchantId)
              ? null
              : draft.merchantId,
          source,
        },
      }
    })
    imported += await bulkAddTransactions(entries)
    onProgress?.(Math.min(at + chunk.length, total), total)
    // Chunked so a 10 000-row import stays a responsive page, not a frozen one.
    if (at + CHUNK_SIZE < total) await yieldToUi()
  }

  // Written last, in its own transaction: a crash mid-commit leaves rows that are still
  // undoable by their `source` marker, which is the fact that matters.
  const batch: LocalImportBatch = {
    id: batchId,
    source: 'csv',
    label: meta.label,
    templateId: meta.templateId,
    rowCount: meta.rowCount,
    importedCount: imported,
    skippedDuplicates: meta.skippedDuplicates,
    errorCount: meta.errorCount,
    walletIds: [...walletIds],
    createdAt: new Date().toISOString(),
    undoneAt: null,
  }
  await saveBatch(batch)

  schedulePush()
  return { batch, learnedSpellings }
}
