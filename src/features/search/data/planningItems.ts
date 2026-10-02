import type { LocalBill, LocalGoal } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { dateLabel, NEUTRAL_COLOR, toBaseMajor, toBaseMinor } from './items'
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

function billItem(b: LocalBill, ctx: ItemContext): SearchItem {
  const leaf = ctx.catalog.has(b.categoryId) ? b.categoryId : null
  const root = leaf ? ctx.catalog.rootOf(leaf) : null
  const repeat =
    b.frequency === null ? 'Just once' : frequencyMetaOf(b, 'monthly').label
  return {
    row: () => ({
      key: `bill:${b.id}`,
      target: { kind: 'bill', id: b.id },
      title: b.name,
      sub: [
        'Bill',
        repeat,
        b.closedAt === null ? `next ${dateLabel(b.nextDue, ctx)}` : 'done',
      ].join(' · '),
      valueStr: formatMoney(b.amount, b.currency),
      positive: false,
      color: b.color,
      iconId: leaf ? ctx.catalog.get(leaf).icon : null,
    }),
    text: searchText([
      b.name,
      b.note,
      'bill',
      ...(leaf ? ctx.catalog.pathOf(leaf) : []),
      ...amountFields(b.amount, b.currency, ctx),
    ]),
    flow: 'spend',
    date: b.nextDue,
    categoryId: leaf,
    rootId: root?.id ?? null,
    wholeCategory: false,
    walletIds: [b.walletId, b.saveWalletId].filter(
      (id): id is string => id !== null,
    ),
    baseMajor: toBaseMajor(b.amount, b.currency, ctx),
  }
}

function goalItem(g: LocalGoal, ctx: ItemContext): SearchItem {
  const figure = g.target ?? g.amount ?? 0
  return {
    row: () => ({
      key: `goal:${g.id}`,
      target: { kind: 'goal', id: g.id },
      title: g.name,
      sub: [
        'Goal',
        g.closedAt !== null
          ? 'reached'
          : g.dueDate
            ? `by ${dateLabel(g.dueDate, ctx)}`
            : g.amount
              ? `${formatMoney(g.amount, g.currency)} a month`
              : null,
      ]
        .filter(Boolean)
        .join(' · '),
      valueStr: figure > 0 ? formatMoney(figure, g.currency) : '',
      positive: false,
      color: g.color || NEUTRAL_COLOR,
      iconId: null,
    }),
    text: searchText([
      g.name,
      'goal',
      ...(figure > 0 ? amountFields(figure, g.currency, ctx) : []),
    ]),
    flow: null,
    date: g.dueDate,
    categoryId: null,
    rootId: null,
    wholeCategory: false,
    walletIds: g.saveWalletId ? [g.saveWalletId] : [],
    baseMajor: figure > 0 ? toBaseMajor(figure, g.currency, ctx) : null,
  }
}

/** Every bill, open ones first. */
export const billItems = (
  bills: ReadonlyArray<LocalBill>,
  ctx: ItemContext,
): SearchItem[] =>
  bills
    .filter((b) => b.deleted === 0)
    .sort(
      (a, b) =>
        Number(a.closedAt !== null) - Number(b.closedAt !== null) ||
        a.position - b.position,
    )
    .map((b) => billItem(b, ctx))

/** Every goal, open ones first. */
export const goalItems = (
  goals: ReadonlyArray<LocalGoal>,
  ctx: ItemContext,
): SearchItem[] =>
  goals
    .filter((g) => g.deleted === 0)
    .sort(
      (a, b) =>
        Number(a.closedAt !== null) - Number(b.closedAt !== null) ||
        a.position - b.position,
    )
    .map((g) => goalItem(g, ctx))
