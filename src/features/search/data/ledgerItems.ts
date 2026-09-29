import type { LocalTransaction } from '#/db/types'
import { isAdjustment, isCashflow } from '#/features/transactions/api/types'
import {
  ADJUSTMENT_LABEL,
  DELETED_ACCOUNT,
} from '#/features/transactions/data/selectors'
import { formatMoney } from '#/lib/currency'
import {
  NEUTRAL_COLOR,
  dateLabel,
  merchantName,
  signedMoney,
  toBaseMajor,
  toBaseMinor,
} from './items'
import type { ItemContext, SearchItem } from './items'
import { amountTexts, searchText } from './match'

const TRANSFER_LABEL = 'Transfer'

const walletNameOf = (walletId: string | undefined, ctx: ItemContext) =>
  (walletId ? ctx.nodeById.get(walletId)?.name : undefined) ?? DELETED_ACCOUNT

/** The amount as stored and as shown in the base currency. */
const amountFields = (t: LocalTransaction, ctx: ItemContext): string[] => [
  ...amountTexts(t.amount, t.currency),
  ...amountTexts(toBaseMinor(t.amount, t.currency, ctx), ctx.base),
]

function cashflowItem(t: LocalTransaction, ctx: ItemContext): SearchItem {
  const { catalog } = ctx
  const leafId = t.categoryId
  const leaf = catalog.get(leafId ?? '')
  const root = leafId ? catalog.rootOf(leafId) : null
  const walletName = walletNameOf(t.walletId, ctx)
  const merchant = merchantName(t.merchantId, ctx)
  const incoming = t.type === 'income'
  return {
    row: () => ({
      key: `tx:${t.id}`,
      target: { kind: 'tx', id: t.id },
      title: t.note || merchant || leaf.name,
      sub: [leaf.name, walletName, dateLabel(t.date, ctx)].join(' · '),
      valueStr: signedMoney(t.amount, t.currency, incoming, ctx),
      positive: incoming,
      color: root?.color ?? NEUTRAL_COLOR,
      iconId: leafId ? leaf.icon : null,
    }),
    text: searchText([
      t.note,
      merchant,
      ...(leafId ? catalog.pathOf(leafId) : []),
      walletName,
      ...amountFields(t, ctx),
    ]),
    flow: incoming ? 'income' : 'spend',
    date: t.date,
    categoryId: leafId,
    rootId: root?.id ?? null,
    wholeCategory: false,
    walletIds: [t.walletId],
    baseMajor: toBaseMajor(t.amount, t.currency, ctx),
  }
}

function adjustmentItem(t: LocalTransaction, ctx: ItemContext): SearchItem {
  const walletName = walletNameOf(t.walletId, ctx)
  const incoming = t.type === 'adjustment_in'
  return {
    row: () => ({
      key: `adjustment:${t.id}`,
      target: { kind: 'adjustment', id: t.id },
      title: t.note || ADJUSTMENT_LABEL,
      sub: `${walletName} · ${dateLabel(t.date, ctx)}`,
      valueStr: signedMoney(t.amount, t.currency, incoming, ctx),
      positive: incoming,
      color: ctx.nodeById.get(t.walletId)?.color ?? NEUTRAL_COLOR,
      iconId: null,
    }),
    text: searchText([
      t.note,
      ADJUSTMENT_LABEL,
      walletName,
      ...amountFields(t, ctx),
    ]),
    flow: null,
    date: t.date,
    categoryId: null,
    rootId: null,
    wholeCategory: false,
    walletIds: [t.walletId],
    baseMajor: toBaseMajor(t.amount, t.currency, ctx),
  }
}

/** One item for a transfer however many of its legs are held. */
function transferItem(
  transferId: string,
  legs: ReadonlyArray<LocalTransaction>,
  ctx: ItemContext,
): SearchItem {
  const out = legs.find((t) => t.type === 'transfer_out')
  const inn = legs.find((t) => t.type === 'transfer_in')
  const shown = out ?? inn ?? legs[0]
  const from = walletNameOf(out?.walletId, ctx)
  const to = walletNameOf(inn?.walletId, ctx)
  return {
    row: () => ({
      key: `transfer:${transferId}`,
      target: { kind: 'transfer', transferId },
      title: shown.note || TRANSFER_LABEL,
      sub: `${from} → ${to} · ${dateLabel(shown.date, ctx)}`,
      valueStr: formatMoney(
        toBaseMinor(shown.amount, shown.currency, ctx),
        ctx.base,
      ),
      positive: false,
      color: NEUTRAL_COLOR,
      iconId: null,
      transfer: true,
    }),
    text: searchText([shown.note, from, to, ...amountFields(shown, ctx)]),
    flow: null,
    date: shown.date,
    categoryId: null,
    rootId: null,
    wholeCategory: false,
    walletIds: [...new Set(legs.map((t) => t.walletId))],
    baseMajor: toBaseMajor(shown.amount, shown.currency, ctx),
  }
}

const newestFirst = (a: LocalTransaction, b: LocalTransaction): number =>
  b.date.localeCompare(a.date) || b.id.localeCompare(a.id)

/** Every live ledger row as an item, newest first, a transfer's legs folded into one. */
export function ledgerItems(
  txns: ReadonlyArray<LocalTransaction>,
  ctx: ItemContext,
): SearchItem[] {
  const live = txns.filter((t) => t.deleted === 0).sort(newestFirst)
  const legsOf = new Map<string, LocalTransaction[]>()
  for (const t of live) {
    if (!t.transferId) continue
    const legs = legsOf.get(t.transferId)
    if (legs) legs.push(t)
    else legsOf.set(t.transferId, [t])
  }

  const items: SearchItem[] = []
  const emitted = new Set<string>()
  for (const t of live) {
    if (t.transferId) {
      if (emitted.has(t.transferId)) continue
      emitted.add(t.transferId)
      items.push(transferItem(t.transferId, legsOf.get(t.transferId)!, ctx))
    } else if (isCashflow(t.type)) items.push(cashflowItem(t, ctx))
    else if (isAdjustment(t.type)) items.push(adjustmentItem(t, ctx))
  }
  return items
}
