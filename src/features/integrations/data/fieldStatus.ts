import type {
  DateFormat,
  Extraction,
  FieldReport,
  LocatorField,
  MappedType,
} from '#/features/integrations/api/ruleTypes'

export type StatusTone = 'ok' | 'error' | 'idle'

/**
 * One line under a field. `value` is what the payload held or produced — rendered as an
 * isolated run so a Latin value reads correctly inside an Arabic sentence and vice versa.
 */
export type StatusLine = {
  tone: StatusTone
  lead: string
  value?: string
  tail?: string
}

export type CategoryWords = { root: string; sub: string | null }

export type StatusContext = {
  /** Whether a usable sample payload is loaded. */
  hasSample: boolean
  /** The dry run of this rule, or null while one is on its way. */
  extraction: Extraction | null
  defaults: {
    currency: string | null
    walletName: string | null
    categoryName: string | null
    type: MappedType
  }
  walletName: (id: string) => string | null
  /** A category id in words: its root's name, and its own when it is a child. */
  category: (id: string) => CategoryWords | null
  formatAmount: (minor: number, currency: string) => string
  formatDate: (iso: string) => string
}

const QUOTE_MAX = 40
const quote = (raw: string | null): string => {
  const text = raw ?? ''
  return `“${text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX)}…` : text}”`
}

const TYPE_LABEL: Record<MappedType, string> = {
  SPEND: 'Spend',
  INCOME: 'Income',
}

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  ISO: 'ISO (2026-09-23)',
  DMY: 'day/month/year',
  MDY: 'month/day/year',
  YMD: 'year/month/day',
  EPOCH_S: 'Unix seconds',
  EPOCH_MS: 'Unix milliseconds',
}

/** What happens when a field is not set — every field has a fallback, and it is said. */
function unsetLine(field: LocatorField, ctx: StatusContext): StatusLine {
  const { defaults } = ctx
  const fallback = (value: string | null, none: string): StatusLine =>
    value
      ? {
          tone: 'idle',
          lead: 'Not set — Means will use the key’s default, ',
          value,
        }
      : { tone: 'idle', lead: none }
  switch (field) {
    case 'amount':
      return {
        tone: 'idle',
        lead: 'Not set — you’ll fill the amount in when you review it.',
      }
    case 'currency':
      return fallback(
        defaults.currency,
        'Not set, and the key has no default currency.',
      )
    case 'date':
      return {
        tone: 'idle',
        lead: 'Not set — Means will use the day it arrives.',
      }
    case 'wallet':
      return fallback(
        defaults.walletName,
        'Not set — you’ll choose it when you review.',
      )
    case 'category':
      return fallback(
        defaults.categoryName,
        'Not set — you’ll choose it when you review.',
      )
    case 'type':
      return fallback(TYPE_LABEL[defaults.type], 'Not set.')
    default:
      return { tone: 'idle', lead: 'Not set.' }
  }
}

export function statusLine(
  field: LocatorField,
  bound: boolean,
  ctx: StatusContext,
): StatusLine {
  if (!bound) return unsetLine(field, ctx)
  if (!ctx.hasSample) {
    return {
      tone: 'idle',
      lead: 'Add a sample payload to see what this finds.',
    }
  }
  if (!ctx.extraction) return { tone: 'idle', lead: 'Checking…' }
  const report = ctx.extraction.fields[field]
  if (!report) return { tone: 'idle', lead: 'Checking…' }
  return reportLine(field, report, ctx)
}

function reportLine(
  field: LocatorField,
  report: FieldReport,
  ctx: StatusContext,
): StatusLine {
  switch (report.status) {
    case 'OK':
      return okLine(field, report, ctx)
    case 'PATH_NOT_FOUND':
      return { tone: 'error', lead: 'Nothing at that path in this payload.' }
    case 'REGEX_NO_MATCH':
      return {
        tone: 'error',
        lead: 'Found ',
        value: quote(report.raw),
        tail: ' but the pattern matched nothing.',
      }
    case 'REGEX_TIMEOUT':
      return { tone: 'error', lead: 'That pattern took too long. Simplify it.' }
    case 'COERCION_FAILED':
      return {
        tone: 'error',
        lead: '',
        value: quote(report.raw),
        tail: COERCION_TAIL[field] ?? ' can’t be used here.',
      }
    case 'UNRESOLVED':
      return unresolvedLine(field, report, ctx)
    case 'NOT_FOUND':
      return {
        tone: 'error',
        lead: 'Couldn’t find it in the message — tap it again on a sample.',
      }
  }
}

const COERCION_TAIL: Partial<Record<LocatorField, string>> = {
  amount: ' is not a number.',
  currency: ' is not a currency Means knows.',
  date: ' is not a date in the layout chosen below.',
}

function okLine(
  field: LocatorField,
  report: FieldReport,
  ctx: StatusContext,
): StatusLine {
  const ok = (value: string, tail?: string): StatusLine => ({
    tone: 'ok',
    lead: 'Reads ',
    value,
    tail,
  })
  const extraction = ctx.extraction
  const text = String(report.value ?? '')
  switch (field) {
    case 'amount': {
      const currency = extraction?.values.currency
      return typeof report.value === 'number' && currency
        ? ok(ctx.formatAmount(report.value, currency))
        : ok(text)
    }
    case 'date':
      return ok(ctx.formatDate(text))
    case 'type':
      return ok((TYPE_LABEL as Partial<Record<string, string>>)[text] ?? text)
    case 'wallet': {
      const id = extraction?.resolved.walletId
      const matched = id ? ctx.walletName(id) : null
      if (matched && matched.toLowerCase() === text.trim().toLowerCase()) {
        return ok(matched)
      }
      return {
        tone: 'idle',
        lead: '',
        value: quote(text),
        tail: matched
          ? ` isn’t one of your accounts — Means will use ${matched}.`
          : ' isn’t one of your accounts — you’ll choose one when you review.',
      }
    }
    case 'category': {
      const named = resolvedCategory(extraction, ctx)
      return named
        ? ok(named.root)
        : {
            tone: 'idle',
            lead: '',
            value: quote(text),
            tail: ' isn’t one of your categories.',
          }
    }
    case 'subcategory': {
      const sub = resolvedCategory(extraction, ctx)?.sub
      return sub
        ? ok(sub)
        : {
            tone: 'idle',
            lead: '',
            value: quote(text),
            tail: ' isn’t a subcategory of that category.',
          }
    }
    default:
      return ok(text)
  }
}

/**
 * The server's words for what it resolved, as they were when it ran (so a delivery reads the
 * same after a rename or delete); without them, the id named as the catalog has it now.
 */
function resolvedCategory(
  extraction: Extraction | null,
  ctx: StatusContext,
): CategoryWords | null {
  const resolved = extraction?.resolved
  if (!resolved) return null
  if (resolved.categoryText) {
    return {
      root: resolved.categoryText,
      sub: resolved.subcategoryText ?? null,
    }
  }
  return resolved.categoryId ? ctx.category(resolved.categoryId) : null
}

function unresolvedLine(
  field: LocatorField,
  report: FieldReport,
  ctx: StatusContext,
): StatusLine {
  if (field === 'amount') {
    return {
      tone: 'error',
      lead: 'Found ',
      value: quote(report.raw),
      tail: ' but there’s no currency to read it in — set Currency, or give the key a default currency.',
    }
  }
  if (field === 'type') {
    return {
      tone: 'idle',
      lead: '',
      value: quote(report.raw),
      tail: ` isn’t in the list below — Means will use ${TYPE_LABEL[ctx.defaults.type]}.`,
    }
  }
  return unsetLine(field, ctx)
}
