import type { LocalBudget, LocalPlanned, LocalRecurring } from '#/db/types'
import { FREQUENCIES } from '#/features/goals/constants'
import {
  customFrequencyMeta,
  frequencyMetaOf,
} from '#/features/goals/data/cadence'
import {
  budgetIdentity,
  budgetPeriodLabel,
} from '#/features/transactions/data/selectors'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import {
  NEUTRAL_COLOR,
  dateLabel,
  merchantName,
  nodeIcon,
  signedMoney,
  toBaseMajor,
  toBaseMinor,
} from './items'
import type { ItemContext, SearchItem } from './items'
import { amountTexts, searchText } from './match'

const amountFields = (
  amount: number,
  currency: CurrencyCode,
  ctx: ItemContext,
): string[] => [
  ...amountTexts(amount, currency),
  ...amountTexts(toBaseMinor(amount, currency, ctx), ctx.base),
]

/** The leaf's icon and names and its root's colour, or nothing for an uncategorised row. */
function categoryFacts(categoryId: string | null, ctx: ItemContext) {
  if (!categoryId) return null
  const root = ctx.catalog.rootOf(categoryId)
  return {
    leafId: categoryId,
    rootId: root.id,
    color: root.color,
    icon: ctx.catalog.get(categoryId).icon,
    path: ctx.catalog.pathOf(categoryId),
  }
}

const seriesOf = (p: LocalPlanned): string | undefined =>
  p.recurringId
    ? `recurring:${p.recurringId}`
    : p.incomeStreamId
      ? `income:${p.incomeStreamId}`
      : p.goalId
        ? `goal:${p.goalId}:${p.role}`
        : undefined

function plannedItem(p: LocalPlanned, ctx: ItemContext): SearchItem {
  const cat = categoryFacts(p.categoryId, ctx)
  const incoming = p.role === 'income'
  return {
    row: () => ({
      key: `planned:${p.id}`,
      target: { kind: 'planned', id: p.id },
      title: p.name,
      sub: `Planned · ${dateLabel(p.date, ctx)}`,
      valueStr: signedMoney(p.amount, p.currency, incoming, ctx),
      positive: incoming,
      color: cat?.color ?? NEUTRAL_COLOR,
      iconId: cat?.icon ?? null,
    }),
    text: searchText([
      p.name,
      p.note,
      ...(cat?.path ?? []),
      ...amountFields(p.amount, p.currency, ctx),
    ]),
    flow: incoming ? 'income' : 'spend',
    date: p.date,
    categoryId: cat?.leafId ?? null,
    rootId: cat?.rootId ?? null,
    wholeCategory: false,
    walletIds: p.walletId ? [p.walletId] : [],
    baseMajor: toBaseMajor(p.amount, p.currency, ctx),
    series: seriesOf(p),
  }
}

/** The open planned items, soonest first. */
export function plannedItems(
  planned: ReadonlyArray<LocalPlanned>,
  ctx: ItemContext,
): SearchItem[] {
  return planned
    .filter((p) => p.deleted === 0 && p.status === 'open')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((p) => plannedItem(p, ctx))
}

/** "/wk", "/mo", "/30d". */
const budgetSuffix = (b: LocalBudget): string =>
  b.period === 'custom'
    ? customFrequencyMeta(b.customDays ?? 30, 'day').short
    : FREQUENCIES[b.period].short

function budgetItem(b: LocalBudget, ctx: ItemContext): SearchItem {
  const identity = budgetIdentity(b, ctx.catalog, ctx.nodeById)
  const wallet =
    b.scopeType === 'wallet' && b.walletId
      ? ctx.nodeById.get(b.walletId)
      : undefined
  const cat =
    b.scopeType === 'category' ? categoryFacts(b.categoryId, ctx) : null
  return {
    row: () => ({
      key: `budget:${b.id}`,
      target: { kind: 'budget', id: b.id },
      title: identity.name,
      sub: `Budget · ${budgetPeriodLabel(b)}`,
      valueStr: `${formatMoney(b.limit, b.currency)}${budgetSuffix(b)}`,
      positive: false,
      color: b.scopeType === 'overall' ? NEUTRAL_COLOR : identity.color,
      iconId: cat?.icon ?? nodeIcon(wallet),
    }),
    text: searchText([
      identity.name,
      ...amountFields(b.limit, b.currency, ctx),
    ]),
    flow: 'spend',
    date: null,
    categoryId: cat?.rootId ?? null,
    rootId: cat?.rootId ?? null,
    wholeCategory: true,
    walletIds: b.scopeType === 'wallet' && b.walletId ? [b.walletId] : [],
    baseMajor: toBaseMajor(b.limit, b.currency, ctx),
  }
}

export function budgetItems(
  budgets: ReadonlyArray<LocalBudget>,
  ctx: ItemContext,
): SearchItem[] {
  return budgets.filter((b) => b.deleted === 0).map((b) => budgetItem(b, ctx))
}

function recurringItem(r: LocalRecurring, ctx: ItemContext): SearchItem {
  const cat = categoryFacts(r.categoryId, ctx)
  const incoming = r.type === 'income'
  return {
    row: () => ({
      key: `recurring:${r.id}`,
      target: { kind: 'recurring', id: r.id },
      title: r.name,
      sub: `${frequencyMetaOf(r).label} · next ${dateLabel(r.nextDue, ctx)}`,
      valueStr: signedMoney(r.amount, r.currency, incoming, ctx),
      positive: incoming,
      color: cat?.color ?? NEUTRAL_COLOR,
      iconId: cat?.icon ?? null,
    }),
    text: searchText([
      r.name,
      r.note,
      ...(cat?.path ?? []),
      merchantName(r.merchantId, ctx),
      ...amountFields(r.amount, r.currency, ctx),
    ]),
    flow: r.type,
    date: r.nextDue,
    categoryId: cat?.leafId ?? null,
    rootId: cat?.rootId ?? null,
    wholeCategory: false,
    walletIds: [r.walletId],
    baseMajor: toBaseMajor(r.amount, r.currency, ctx),
  }
}

/** Every live schedule, next due first. */
export function recurringItems(
  recurrings: ReadonlyArray<LocalRecurring>,
  ctx: ItemContext,
): SearchItem[] {
  return recurrings
    .filter((r) => r.deleted === 0)
    .sort(
      (a, b) => a.nextDue.localeCompare(b.nextDue) || a.id.localeCompare(b.id),
    )
    .map((r) => recurringItem(r, ctx))
}
