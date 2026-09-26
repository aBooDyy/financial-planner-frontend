import { hasErrors } from './types'
import type { ParsedRow } from './types'

/**
 * How a row reads in review. Every status is carried by a glyph *and* a word — colour alone
 * would leave the table unreadable for a third of the reasons people fail to read tables.
 */
export type RowStatus = 'error' | 'warning' | 'ok'

export type ReviewFilter = 'all' | RowStatus

export const REVIEW_FILTERS: ReadonlyArray<ReviewFilter> = [
  'all',
  'ok',
  'warning',
  'error',
]

export const statusOf = (row: ParsedRow): RowStatus => {
  if (row.draft === null || hasErrors(row.issues)) return 'error'
  return row.issues.length > 0 ? 'warning' : 'ok'
}

export type ReviewCounts = Record<RowStatus, number> & { total: number }

export const countStatuses = (rows: ReadonlyArray<ParsedRow>): ReviewCounts => {
  const counts: ReviewCounts = {
    total: rows.length,
    ok: 0,
    warning: 0,
    error: 0,
  }
  for (const row of rows) counts[statusOf(row)] += 1
  return counts
}

/** Attention first. The rank is also how a scanned row's status is stored. */
export const STATUS_RANK: Readonly<Record<RowStatus, number>> = {
  error: 0,
  warning: 1,
  ok: 2,
}

export const RANKED_STATUS: ReadonlyArray<RowStatus> = [
  'error',
  'warning',
  'ok',
]

/**
 * Row indices in the order the table shows them: what needs attention first, then the file's
 * own order. Computed over the *derived* rows, never over the corrected view, so fixing a
 * row cannot make it jump out from under the pointer.
 */
export const reviewOrder = (rows: ReadonlyArray<ParsedRow>): number[] =>
  rows
    .map((row, position) => ({ position, rank: STATUS_RANK[statusOf(row)] }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.position)

/** A transfer with no other side keeps its draft for display, so the issues decide too. */
export const isCommittable = (row: ParsedRow): boolean =>
  row.draft !== null && !row.excluded && !hasErrors(row.issues)
