import { ADJUSTMENT_LABEL } from '#/features/transactions/data/selectors'
import { messageForCode } from '#/lib/errorMessages'
import { formatMoney } from '#/lib/currency'
import { stripReference } from './reference'
import { statusOf } from './review'
import type { RowStatus } from './review'
import type { ParsedRow, RowIssue, RowIssueField } from './types'

/**
 * One row as the review table reads it. Every label the table shows is resolved here, so
 * the row component stays presentational and the wording stays testable.
 */

export type RowLabels = {
  wallet: (id: string | null) => string
  category: (id: string) => string
  merchant: (id: string | null) => string | null
  date: (iso: string) => string
}

/** How the amount reads: money earned, money spent, or money only moving (never a total). */
export type AmountTone = 'income' | 'spend' | 'neutral'

export type RowView = {
  status: RowStatus
  date: string
  description: string
  amount: string
  tone: AmountTone
  category: string
  wallet: string
  /** The one-line reason the row is not simply ready. */
  reason: string | null
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

/** What sits in the category column: the category, or what the row is instead of one. */
const categoryText = (row: ParsedRow, labels: RowLabels): string => {
  const draft = row.draft
  if (draft === null) return MISSING
  if (row.intent === 'adjustment') return ADJUSTMENT_LABEL
  if (row.intent === 'transfer') {
    const other = row.transfer?.counterpartId ?? null
    if (other === null) return 'Transfer'
    return `Transfer ${draft.type === 'spend' ? '→' : '←'} ${labels.wallet(other)}`
  }
  return labels.category(draft.categoryId)
}

const toneOf = (row: ParsedRow): AmountTone => {
  if (row.intent !== 'cashflow') return 'neutral'
  return row.draft?.type === 'income' ? 'income' : 'spend'
}

export const describeRow = (row: ParsedRow, labels: RowLabels): RowView => {
  const status = statusOf(row)
  const draft = row.draft
  const merchant = labels.merchant(draft?.merchantId ?? null)
  const note = stripReference(draft?.note ?? null)
  const issue = worstIssue(row.issues)

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
    tone: toneOf(row),
    category: categoryText(row, labels),
    wallet: labels.wallet(draft?.walletId ?? null),
    reason: issue === null ? null : issueText(issue, row.line),
  }
}
