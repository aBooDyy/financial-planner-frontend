import { isCashflow } from '#/features/transactions/api/types'
import { normalizeKey } from './matching'
import type { TransactionType, TxType } from '#/features/transactions/api/types'
import type { DedupeSettings, ParsedRow } from './types'

/**
 * Importing the same statement twice is the most likely way this feature damages a ledger,
 * so every row carries two keys: the bank's own reference when the file has one, and a
 * fingerprint for when it does not. Both are matched against the existing ledger *and*
 * against earlier rows of the same file.
 */

/**
 * `t_transactions` has one `source` column and no metadata field, and the batch marker has
 * to win it (undo depends on it), so a mapped reference rides at the end of the note.
 */
export const REFERENCE_MARK = ' · ref:'

const REFERENCE_RE = /(?:^|\s·\s)ref:([^·]+)$/

export const referenceFromNote = (note: string | null): string | null => {
  const match = note === null ? null : REFERENCE_RE.exec(note)
  return match ? match[1].trim() : null
}

export const stripReference = (note: string | null): string | null => {
  if (note === null) return null
  const stripped = note.replace(REFERENCE_RE, '').trim()
  return stripped === '' ? null : stripped
}

/** Append the bank's reference to the note it will be committed with. */
export const withReference = (
  note: string | null,
  reference: string | null,
): string | null => {
  if (reference === null || reference === '') return note
  if (note === null || note === '') return `ref:${reference}`
  return `${note}${REFERENCE_MARK}${reference}`
}

export const referenceKey = (reference: string): string =>
  `ref:${normalizeKey(reference)}`

// --- Fingerprints --------------------------------------------------------------------

export type FingerprintParts = {
  date: string
  type: TxType
  amount: number
  currency: string
  walletId: string
  /** Undefined and null both mean "no merchant on this row". */
  merchantId?: string | null
  note: string | null
  /** Money moved between wallets or a balance corrected, rather than earned or spent. */
  movement?: boolean
}

/**
 * The label every movement shares. The two sides of a transfer carry different notes ("Send
 * to X" / "Received from Y") while the ledger keeps one for both legs, so a movement is
 * matched on amount, direction, wallet and date alone. `normalizeKey` never yields `~`, so
 * no cash-flow label can collide with it.
 */
const MOVEMENT_LABEL = '~'

/**
 * The counterparty half of the key: merchant and the whole note, so only a row that repeats
 * another on every field is flagged. The reference suffix is stripped so a row imported with
 * a reference still matches the same row typed in by hand.
 */
const labelOf = (parts: FingerprintParts): string => {
  if (parts.movement === true) return MOVEMENT_LABEL
  const note = normalizeKey(stripReference(parts.note) ?? '')
  return `m:${parts.merchantId ?? ''}|${note}`
}

export const fingerprintOf = (parts: FingerprintParts): string =>
  [
    parts.date,
    parts.type,
    parts.amount,
    parts.currency,
    parts.walletId,
    labelOf(parts),
  ].join('|')

// --- The ledger index ----------------------------------------------------------------

/** The columns of an existing transaction duplicate detection needs. */
export type LedgerTransaction = {
  id: string
  date: string
  type: TxType
  amount: number
  currency: string
  walletId: string
  merchantId: string | null
  note: string | null
  movement?: boolean
}

/**
 * A ledger row as the index reads it. A transfer leg or an adjustment is filed by its
 * direction on its own wallet — out as money out, in as money in — so re-importing a file, or
 * importing the other wallet's statement, finds the movement already there.
 */
export const toLedgerEntry = (row: {
  id: string
  date: string
  type: TransactionType
  amount: number
  currency: string
  walletId: string
  merchantId: string | null
  note: string | null
}): LedgerTransaction =>
  isCashflow(row.type)
    ? { ...row, type: row.type }
    : {
        ...row,
        type:
          row.type === 'transfer_out' || row.type === 'adjustment_out'
            ? 'spend'
            : 'income',
        movement: true,
      }

export type DedupeIndex = {
  byReference: Map<string, string>
  byKey: Map<string, string>
}

export const emptyDedupeIndex = (): DedupeIndex => ({
  byReference: new Map(),
  byKey: new Map(),
})

const add = (index: DedupeIndex, id: string, fingerprint: string): void => {
  if (!index.byKey.has(fingerprint)) index.byKey.set(fingerprint, id)
}

/** One pass over the ledger rows — a single Dexie read, never a query per row. */
export const buildDedupeIndex = (
  rows: ReadonlyArray<LedgerTransaction>,
): DedupeIndex => {
  const index = emptyDedupeIndex()
  for (const row of rows) {
    const reference = referenceFromNote(row.note)
    if (reference !== null) {
      const key = referenceKey(reference)
      if (!index.byReference.has(key)) index.byReference.set(key, row.id)
    }
    add(index, row.id, fingerprintOf(row))
  }
  return index
}

/** What a row repeats: an existing ledger transaction, or an earlier row of this file. */
export type DuplicateMark = {
  ledgerId: string | null
  earlierIndex: number | null
}

/** The rows of this file already checked, keyed the same two ways as the ledger. */
export type SeenRows = { index: DedupeIndex; references: Map<string, number> }

export const emptySeen = (): SeenRows => ({
  index: emptyDedupeIndex(),
  references: new Map(),
})

/**
 * What one row repeats, or null. The first occurrence always wins and is recorded in
 * `seen`; later ones are marked but never hidden, because two identical coffees on one day
 * are a real thing a person may want to keep.
 *
 * Run this **after** the merchant prediction: binding a merchant changes the fingerprint.
 */
export const markRow = (
  row: ParsedRow,
  ledger: DedupeIndex,
  seen: SeenRows,
  settings: DedupeSettings,
): DuplicateMark | null => {
  if (settings.strategy === 'off') return null
  if (row.draft === null || row.fingerprint === '') return null

  // A mapped reference is exact; without one (or with the fingerprint strategy chosen)
  // the same-day fingerprint is all there is.
  const key =
    settings.strategy === 'reference' && row.reference !== null
      ? referenceKey(row.reference)
      : null

  const ledgerHit =
    key !== null
      ? (ledger.byReference.get(key) ?? null)
      : (ledger.byKey.get(row.fingerprint) ?? null)
  if (ledgerHit !== null) return { ledgerId: ledgerHit, earlierIndex: null }

  const fileHit =
    key !== null
      ? (seen.references.get(key) ?? null)
      : earlierRow(seen.index, row.fingerprint)
  if (fileHit !== null) return { ledgerId: null, earlierIndex: fileHit }

  if (key !== null) seen.references.set(key, row.index)
  else add(seen.index, String(row.index), row.fingerprint)
  return null
}

/** Lay a mark on the row it belongs to. A row that repeats nothing is returned untouched. */
export const withDuplicate = (
  row: ParsedRow,
  mark: DuplicateMark | undefined,
): ParsedRow =>
  mark === undefined
    ? row
    : {
        ...row,
        duplicateOf: mark.ledgerId,
        duplicateOfIndex: mark.earlierIndex,
        excluded: true,
      }

const earlierRow = (seen: DedupeIndex, fingerprint: string): number | null => {
  const hit = seen.byKey.get(fingerprint)
  return hit === undefined ? null : Number(hit)
}
