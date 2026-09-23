import { messageForCode } from '#/lib/errorMessages'
import { formatMoney } from '#/lib/currency'
import { stripReference } from './dedupe'
import { statusOf } from './review'
import type { RowStatus } from './review'
import type { ParsedRow, RowIssue, RowIssueField } from './types'

/**
 * One row as the review table reads it. Every label the table shows is resolved here, so
 * the row component stays presentational and the wording stays testable.
 */

export type RowLabels = {
  wallet: (id: string | null) => string
  category: (category: string, subcategory: string | null) => string
  merchant: (id: string | null) => string | null
  date: (iso: string) => string
  /** Names the ledger row a duplicate repeats, when it can be found. */
  transaction: (id: string) => string | null
}

export type RowView = {
  status: RowStatus
  date: string
  description: string
  amount: string
  income: boolean
  category: string
  wallet: string
  /** The one-line reason the row is not simply ready. */
  reason: string | null
  /** What the duplicate `ⓘ` says, when this row repeats something. */
  duplicate: string | null
}

const MISSING = '—'

const detailFor = (
  issues: ReadonlyArray<RowIssue>,
  field: RowIssueField,
): string | null =>
  issues.find((issue) => issue.field === field)?.detail ?? null

const quoted = (value: string | null): string | null =>
  value === null || value.trim() === '' ? null : `“${value.trim()}”`

const worstIssue = (issues: ReadonlyArray<RowIssue>): RowIssue | null =>
  issues.find((issue) => issue.level === 'error') ?? issues.at(0) ?? null

const issueText = (issue: RowIssue, line: number): string => {
  const detail = quoted(issue.detail ?? null)
  const message = messageForCode(issue.code)
  return `Line ${line} · ${detail === null ? message : `${message} ${detail}`}`
}

const duplicateText = (row: ParsedRow, labels: RowLabels): string | null => {
  if (row.duplicateOf !== null) {
    const named = labels.transaction(row.duplicateOf)
    return named === null
      ? 'Already in Means — a transaction you already have matches this row.'
      : `Already in Means — matches ${named}.`
  }
  if (row.duplicateOfIndex !== null) {
    return `Repeats an earlier row of this file (row ${row.duplicateOfIndex + 1}).`
  }
  return null
}

export const describeRow = (row: ParsedRow, labels: RowLabels): RowView => {
  const status = statusOf(row)
  const draft = row.draft
  const merchant = labels.merchant(draft?.merchantId ?? null)
  const note = stripReference(draft?.note ?? null)
  const issue = worstIssue(row.issues)
  const duplicate = duplicateText(row, labels)

  return {
    status,
    date:
      draft === null
        ? (quoted(detailFor(row.issues, 'date')) ?? MISSING)
        : labels.date(draft.date),
    description: merchant ?? note ?? '(no description)',
    amount:
      draft === null
        ? (quoted(detailFor(row.issues, 'amount')) ?? MISSING)
        : `${draft.type === 'spend' ? '−' : '+'}${formatMoney(draft.amount, draft.currency)}`,
    income: draft?.type === 'income',
    category:
      draft === null
        ? MISSING
        : labels.category(draft.category, draft.subcategory),
    wallet: labels.wallet(draft?.walletId ?? null),
    reason:
      status === 'duplicate'
        ? duplicate
        : issue === null
          ? null
          : issueText(issue, row.line),
    duplicate,
  }
}
