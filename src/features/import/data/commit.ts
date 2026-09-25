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
import { bulkAddTransfers } from '#/features/transactions/data/transfers'
import { batchSource, saveBatch } from './batches'
import { normalizeKey } from './matching'
import { isCommittable } from './review'
import { roleColumn } from './types'
import type { LocalImportBatch } from '#/db/types'
import type {
  LedgerDraft,
  TransactionDraft,
} from '#/features/transactions/data/mutations'
import type { TransferDraft } from '#/features/transactions/data/transfers'
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
 * The rows to write, read in chunks rather than handed over as one array. The two sides of a
 * paired transfer arrive next to each other, so a chunk boundary is the only thing that can
 * part them — and the commit holds a side over it until the other arrives. A 50 000-row
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

/** The row as one ordinary ledger row: spending, income, or a balance adjustment. */
const ledgerDraftOf = (
  row: ParsedRow,
  source: string,
  unresolved: ReadonlySet<string>,
): LedgerDraft => {
  const draft = row.draft as TransactionDraft
  if (row.intent === 'adjustment') {
    return {
      type: draft.type === 'spend' ? 'adjustment_out' : 'adjustment_in',
      amount: draft.amount,
      currency: draft.currency,
      walletId: draft.walletId,
      date: draft.date,
      note: draft.note,
      source,
    }
  }
  return {
    ...draft,
    merchantId:
      draft.merchantId != null && unresolved.has(draft.merchantId)
        ? null
        : draft.merchantId,
    source,
  }
}

/** One row naming its other wallet, as the transfer it describes. */
const loneTransfer = (row: ParsedRow): TransferDraft | null => {
  const draft = row.draft as TransactionDraft
  const other = row.transfer?.counterpartId ?? null
  if (other === null) return null
  const out = draft.type === 'spend'
  return {
    fromWalletId: out ? draft.walletId : other,
    toWalletId: out ? other : draft.walletId,
    amount: draft.amount,
    fromCurrency: draft.currency,
    toAmount: draft.amount,
    toCurrency: draft.currency,
    date: draft.date,
    note: draft.note,
  }
}

/** Both sides of a paired transfer: dated and noted by the money-out side. */
const pairedTransfer = (a: ParsedRow, b: ParsedRow): TransferDraft => {
  const [out, inn] = [a, b].map((row) => row.draft as TransactionDraft)
  const [from, to] = out.type === 'spend' ? [out, inn] : [inn, out]
  return {
    fromWalletId: from.walletId,
    toWalletId: to.walletId,
    amount: from.amount,
    fromCurrency: from.currency,
    toAmount: to.amount,
    toCurrency: to.currency,
    date: from.date,
    note: from.note ?? to.note,
  }
}

/**
 * Every transfer the rows describe, gathered as the rows stream past. A side whose partner
 * is still to come is held; one whose partner never comes is written from its own row, which
 * already names the partner's wallet.
 */
const transferCollector = () => {
  const drafts: TransferDraft[] = []
  const waiting = new Map<number, ParsedRow>()
  const push = (draft: TransferDraft | null) => {
    if (draft !== null) drafts.push(draft)
  }
  return {
    add: (row: ParsedRow) => {
      const partner = row.transfer?.pairIndex ?? null
      if (partner === null) return push(loneTransfer(row))
      const other = waiting.get(partner)
      if (other === undefined) {
        waiting.set(row.index, row)
        return
      }
      waiting.delete(partner)
      push(pairedTransfer(other, row))
    },
    finish: (): TransferDraft[] => {
      for (const row of waiting.values()) push(loneTransfer(row))
      waiting.clear()
      return drafts
    },
  }
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
  const transfers = transferCollector()
  let imported = 0
  onProgress?.(0, total)

  for (let at = 0; at < total; at += CHUNK_SIZE) {
    const chunk = rows.rowsAt(at, Math.min(at + CHUNK_SIZE, total))
    const entries: Array<{ id: string; draft: LedgerDraft }> = []
    for (const row of chunk) {
      if (row.intent === 'transfer') {
        transfers.add(row)
        continue
      }
      const draft = ledgerDraftOf(row, source, unresolved)
      walletIds.add(draft.walletId)
      entries.push({ id: crypto.randomUUID(), draft })
    }
    imported += await bulkAddTransactions(entries)
    onProgress?.(Math.min(at + chunk.length, total), total)
    // Chunked so a 10 000-row import stays a responsive page, not a frozen one.
    if (at + CHUNK_SIZE < total) await yieldToUi()
  }

  // After every ledger row, so the outbox holds one run of each and each drains as few bulk
  // requests as it can. The drafts are a few numbers each, not rows.
  const drafts = transfers.finish()
  let transferred = 0
  for (let at = 0; at < drafts.length; at += CHUNK_SIZE) {
    const slice = drafts.slice(at, at + CHUNK_SIZE)
    for (const draft of slice) {
      walletIds.add(draft.fromWalletId)
      walletIds.add(draft.toWalletId)
    }
    transferred += await bulkAddTransfers(
      slice.map((draft) => ({ id: crypto.randomUUID(), draft })),
      source,
    )
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
    transferCount: transferred,
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
