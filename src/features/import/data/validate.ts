import { ROW_ISSUES, lookup } from './types'
import type { Mapping, RowContext, RowFacts, RowIssue } from './types'

/**
 * The rule table: facts in, issues out. Pure and ordered, so review copy reads top-to-bottom
 * the way a person checks a row. An `error` blocks the row from being committed; a `warning`
 * is informational and commits by default.
 */

const EPOCH = '1970-01-01'

const DAY_MS = 24 * 60 * 60 * 1000

/** Users do import future-dated rows, so only the far side of tomorrow is suspicious. */
const tomorrow = (today: string): string =>
  new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)

export const validateRow = (
  facts: RowFacts,
  mapping: Mapping,
  context: RowContext,
): RowIssue[] => {
  const issues: RowIssue[] = []
  // A movement is written in the wallet's own currency and must move something, so what is
  // only worth a warning on spending blocks it.
  const movement = facts.intent !== 'cashflow'
  const add = (
    level: RowIssue['level'],
    field: RowIssue['field'],
    code: RowIssue['code'],
    detail?: string,
  ) => {
    issues.push(
      detail === undefined
        ? { level, field, code }
        : { level, field, code, detail },
    )
  }

  if (facts.date === null) {
    add('error', 'date', ROW_ISSUES.dateUnreadable, facts.dateCell)
  } else {
    if (mapping.dateAmbiguous) {
      add('warning', 'date', ROW_ISSUES.dateAmbiguous, facts.dateCell)
    }
    if (facts.date > tomorrow(context.today) || facts.date < EPOCH) {
      add('warning', 'date', ROW_ISSUES.dateImplausible, facts.dateCell)
    }
  }

  if (facts.amountState === 'unreadable') {
    add('error', 'amount', ROW_ISSUES.amountUnreadable, facts.amountCell)
  } else if (facts.amountState === 'ambiguous') {
    add('error', 'amount', ROW_ISSUES.amountAmbiguous, facts.amountCell)
  } else if (facts.amountState === 'missing') {
    add('error', 'amount', ROW_ISSUES.amountMissing)
  } else if (facts.amountState === 'ok' && facts.amountMinor === 0) {
    add(
      movement ? 'error' : 'warning',
      'amount',
      ROW_ISSUES.amountZero,
      facts.amountCell,
    )
  }

  if (facts.currency === null) {
    add('error', 'currency', ROW_ISSUES.currencyUnsupported, facts.currencyCell)
  } else if (facts.walletId !== null) {
    const walletCurrency = lookup(context.walletCurrencies, facts.walletId)
    if (walletCurrency !== undefined && walletCurrency !== facts.currency) {
      add(
        movement ? 'error' : 'warning',
        'currency',
        ROW_ISSUES.currencyMismatch,
        facts.currency,
      )
    }
  }

  // A wallet alias mapped to "skip these rows" leaves silently — it was asked for.
  if (facts.walletId === null && !facts.walletSkipped) {
    add('error', 'wallet', ROW_ISSUES.walletUnresolved)
  }

  if (facts.categoryDefaulted && !movement) {
    add('warning', 'category', ROW_ISSUES.categoryDefaulted)
  }
  // The server refuses a category it does not hold (deleted, or a create this import no longer
  // makes), and spending filed under an income category, and the reverse.
  const categoryType = lookup(context.categoryTypes, facts.categoryId)
  if (!movement && categoryType === undefined) {
    add('error', 'category', ROW_ISSUES.categoryMissing)
  } else if (!movement && categoryType !== facts.type) {
    add('error', 'category', ROW_ISSUES.categoryTypeMismatch)
  }
  if (facts.typeDefaulted) {
    add('warning', 'type', ROW_ISSUES.typeDefaulted)
  }
  if (facts.ragged) {
    add('warning', 'row', ROW_ISSUES.ragged, String(facts.raw.length))
  }

  return issues
}
