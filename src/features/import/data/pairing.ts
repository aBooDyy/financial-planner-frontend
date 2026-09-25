import { stripReference } from './dedupe'
import { normalizeKey } from './matching'
import { ROW_ISSUES, lookup } from './types'
import type { TransactionDraft } from '#/features/transactions/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import type { Mapping, ParsedRow, RowContext, RowIssue } from './types'

/**
 * Transfers inside a file. An export that covers several wallets lists each transfer twice —
 * money out of one wallet, money into another — and the pass pairs the two sides into one
 * transfer. A side whose partner is not in the file needs its other wallet named: by the
 * user in review, or by its own note ("Send to STC Pay").
 */

/** Two sides of one transfer may be booked this many days apart. */
export const PAIR_WINDOW_DAYS = 2

/** The other side of a paired row: its file row, and the wallet it sits in. */
export type TransferPair = { partner: number; walletId: string }

export type PairCandidate = {
  index: number
  out: boolean
  currency: string
  amount: number
  walletId: string
  day: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const dayOf = (iso: string): number =>
  Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)

/** A transfer row that could have a partner in the file: readable, kept, and non-zero. */
export const candidateOf = (row: ParsedRow): PairCandidate | null => {
  const draft = row.draft
  if (row.intent !== 'transfer' || draft === null || row.excluded) return null
  if (draft.amount <= 0) return null
  return {
    index: row.index,
    out: draft.type === 'spend',
    currency: draft.currency,
    amount: draft.amount,
    walletId: draft.walletId,
    day: dayOf(draft.date),
  }
}

type Bucket = { list: PairCandidate[]; next: number }

const bucketKey = (currency: string, amount: number, day: number): string =>
  `${currency}|${amount}|${day}`

/**
 * Pair every money-out side with a money-in side of the same currency and amount, in another
 * wallet, at most `PAIR_WINDOW_DAYS` apart — the same day first, then the closest, and the
 * earliest row in the file on a tie. Greedy in file order, so the same file always pairs the
 * same way. Each side sits in a bucket keyed by its exact amount and day, so a side looks at
 * five small buckets rather than the file.
 */
export const pairTransfers = (
  candidates: ReadonlyArray<PairCandidate>,
): Map<number, TransferPair> => {
  const ordered = [...candidates].sort((a, b) => a.index - b.index)
  const buckets = new Map<string, Bucket>()
  for (const side of ordered) {
    if (side.out) continue
    const key = bucketKey(side.currency, side.amount, side.day)
    const bucket = buckets.get(key)
    if (bucket) bucket.list.push(side)
    else buckets.set(key, { list: [side], next: 0 })
  }

  const taken = new Set<number>()
  const firstFree = (
    bucket: Bucket | undefined,
    walletId: string,
  ): PairCandidate | null => {
    if (bucket === undefined) return null
    while (
      bucket.next < bucket.list.length &&
      taken.has(bucket.list[bucket.next].index)
    ) {
      bucket.next += 1
    }
    for (let at = bucket.next; at < bucket.list.length; at += 1) {
      const side = bucket.list[at]
      if (!taken.has(side.index) && side.walletId !== walletId) return side
    }
    return null
  }

  const pairs = new Map<number, TransferPair>()
  for (const out of ordered) {
    if (!out.out) continue
    let match: PairCandidate | null = null
    for (let gap = 0; gap <= PAIR_WINDOW_DAYS && match === null; gap += 1) {
      const days = gap === 0 ? [out.day] : [out.day - gap, out.day + gap]
      for (const day of days) {
        const found = firstFree(
          buckets.get(bucketKey(out.currency, out.amount, day)),
          out.walletId,
        )
        if (found !== null && (match === null || found.index < match.index)) {
          match = found
        }
      }
    }
    if (match === null) continue
    taken.add(match.index)
    pairs.set(out.index, { partner: match.index, walletId: match.walletId })
    pairs.set(match.index, { partner: out.index, walletId: out.walletId })
  }
  return pairs
}

// --- The other wallet of a side with no partner ------------------------------------------

/** What a note is read against: every name a wallet goes by here and in the file. */
export type TransferLookup = {
  names: ReadonlyArray<{ key: string; walletId: string }>
  currencies: Readonly<Record<string, CurrencyCode>>
}

/**
 * The user's wallet names plus the file's own spellings of them — a note written by the app
 * that exported the file names wallets the way that app does, which is exactly what step ③
 * bound to ours.
 */
export const transferLookupOf = (
  mapping: Mapping,
  context: RowContext,
): TransferLookup => {
  const seen = new Set<string>()
  const names: Array<{ key: string; walletId: string }> = []
  const currencies: Record<string, CurrencyCode> = {
    ...context.walletCurrencies,
  }
  const add = (raw: string, walletId: string) => {
    const key = normalizeKey(raw)
    const id = `${key}|${walletId}`
    if (key === '' || seen.has(id)) return
    seen.add(id)
    names.push({ key, walletId })
  }
  for (const [walletId, name] of Object.entries(context.walletNames)) {
    add(name, walletId)
  }
  for (const [key, target] of Object.entries(mapping.aliases.wallets)) {
    if (target.kind === 'skip') continue
    add(key, target.walletId)
    if (target.kind === 'create') {
      add(target.name, target.walletId)
      currencies[target.walletId] = target.currency
    }
  }
  return { names, currencies }
}

const contains = (haystack: string, needle: string): boolean =>
  ` ${haystack} `.includes(` ${needle} `)

/**
 * The one other wallet a note names, or null. A longer name wins over one it contains —
 * "Home bank 2" is not also "Home bank" — and two wallets named at once are no answer.
 */
export const counterpartInNote = (
  note: string | null,
  ownWalletId: string,
  known: TransferLookup,
): string | null => {
  const text = normalizeKey(stripReference(note) ?? '')
  if (text === '') return null
  const hits = known.names.filter(
    (name) => name.walletId !== ownWalletId && contains(text, name.key),
  )
  const specific = hits.filter(
    (hit) =>
      !hits.some(
        (other) => other.key !== hit.key && contains(other.key, hit.key),
      ),
  )
  const wallets = new Set(specific.map((hit) => hit.walletId))
  return wallets.size === 1 ? [...wallets][0] : null
}

const issueFor = (
  draft: TransactionDraft,
  counterpartId: string | null,
  guessed: boolean,
  known: TransferLookup,
): RowIssue | null => {
  if (counterpartId === null) {
    return {
      level: 'error',
      field: 'transfer',
      code: ROW_ISSUES.transferUnpaired,
    }
  }
  if (counterpartId === draft.walletId) {
    return {
      level: 'error',
      field: 'transfer',
      code: ROW_ISSUES.transferSameWallet,
    }
  }
  const currency = lookup(known.currencies, counterpartId)
  if (currency !== undefined && currency !== draft.currency) {
    return {
      level: 'error',
      field: 'transfer',
      code: ROW_ISSUES.transferCurrency,
      detail: currency,
    }
  }
  return guessed
    ? { level: 'warning', field: 'transfer', code: ROW_ISSUES.transferGuessed }
    : null
}

/**
 * Lay the file-wide answer on one transfer row: its partner when it has one, otherwise the
 * other wallet it names — the user's choice first, then its note — and whatever that leaves
 * wrong. Every other row is returned untouched.
 */
export const settleTransfer = (
  row: ParsedRow,
  pair: TransferPair | undefined,
  known: TransferLookup,
): ParsedRow => {
  const draft = row.draft
  if (row.intent !== 'transfer' || draft === null) return row
  if (pair !== undefined) {
    return {
      ...row,
      transfer: {
        pairIndex: pair.partner,
        counterpartId: pair.walletId,
        guessed: false,
      },
    }
  }
  const chosen = row.transfer?.counterpartId ?? null
  const guess =
    chosen === null
      ? counterpartInNote(draft.note, draft.walletId, known)
      : null
  const counterpartId = chosen ?? guess
  const issue = issueFor(draft, counterpartId, guess !== null, known)
  return {
    ...row,
    transfer: { pairIndex: null, counterpartId, guessed: guess !== null },
    issues: issue === null ? row.issues : [...row.issues, issue],
  }
}

/** The pair a built row already carries, to be kept across a correction. */
export const pairOf = (row: ParsedRow): TransferPair | undefined => {
  const transfer = row.transfer
  return transfer === null ||
    transfer.pairIndex === null ||
    transfer.counterpartId === null
    ? undefined
    : { partner: transfer.pairIndex, walletId: transfer.counterpartId }
}
