import type { LocalTransaction } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import {
  buildActivityList,
  walletMatcher,
} from '#/features/transactions/data/selectors'
import type {
  ActivityListView,
  Scope,
  SpendingInputs,
} from '#/features/transactions/data/selectors'
import { convertMinor, formatMoney } from '#/lib/currency'
import type { DateFormat } from '#/lib/date'
import { ROOT_ITSELF_LABEL } from './breakdown'
import { rowsIn } from './flowRows'
import { bucketOf } from './needsWants'
import type { SpendBucket } from './needsWants'
import {
  SPEND_CLASS_LABEL,
  UNSORTED_LABEL,
} from '#/features/categories/spendClass'
import type { ReportWindow } from './range'

/** A breakdown row whose transactions are asked for. */
export type CategoryPick = {
  type: TxType
  rootId: string
  /** One subcategory beneath the root — the root's own id for its "General" rows — or null for all of it. */
  subId: string | null
  /**
   * Only the spends in this Needs / Wants / Savings bucket — the card's drill-down. Without
   * it a spend pick leaves out the Savings bucket, as Reports' spending does.
   */
  bucket?: SpendBucket
}

export type CategoryTxnsView = {
  /** "Dining", or "Dining · Cafés" for a subcategory. */
  title: string
  countStr: string
  totalStr: string
  list: ActivityListView
}

type Inputs = {
  rows: ReadonlyArray<LocalTransaction>
  pick: CategoryPick
  catalog: CategoryCatalog
  scope: Scope
  period: Pick<ReportWindow, 'start' | 'dataEnd'>
  today: Date
  inputs: SpendingInputs
  dateFormat: DateFormat
}

/** Exactly the rows the breakdown totalled for the pick: live, in scope, in the period. */
export function categoryTxnsOf({
  rows,
  pick,
  catalog,
  scope,
  period,
  inputs,
}: Omit<Inputs, 'today' | 'dateFormat'>): LocalTransaction[] {
  const inScope = walletMatcher(scope, [...inputs.nodes])
  const inBucket = (categoryId: string) => {
    if (pick.type !== 'spend') return true
    const bucket = bucketOf(catalog, categoryId)
    return pick.bucket === undefined
      ? bucket !== 'saving'
      : bucket === pick.bucket
  }
  const inPick = (categoryId: string) =>
    (pick.subId !== null
      ? categoryId === pick.subId
      : catalog.rootOf(categoryId).id === pick.rootId) && inBucket(categoryId)
  return rowsIn(rows, period).filter(
    (t) =>
      t.deleted === 0 &&
      t.type === pick.type &&
      t.categoryId !== null &&
      inPick(t.categoryId) &&
      inScope(t.walletId),
  )
}

/** The pick's transactions grouped by day, as Spending's Activity list draws them. */
export function buildCategoryTxns(args: Inputs): CategoryTxnsView {
  const { pick, catalog, scope, period, today, inputs, dateFormat } = args
  const txns = categoryTxnsOf(args)
  const root = catalog.get(pick.rootId)
  const total = txns.reduce(
    (sum, t) =>
      sum + convertMinor(t.amount, t.currency, inputs.base, inputs.rates),
    0,
  )
  const count = txns.length
  const list = buildActivityList(
    { ...inputs, txns, setAsides: [] },
    catalog,
    scope,
    { mode: 'custom', start: period.start, end: period.dataEnd },
    today,
    dateFormat,
  )
  const subName =
    pick.subId === null
      ? null
      : pick.subId === pick.rootId
        ? ROOT_ITSELF_LABEL
        : catalog.get(pick.subId).name

  const bucketName =
    pick.bucket === undefined
      ? null
      : pick.bucket === 'unsorted'
        ? UNSORTED_LABEL
        : SPEND_CLASS_LABEL[pick.bucket]

  return {
    title: [root.name, subName, bucketName].filter(Boolean).join(' · '),
    countStr: `${count} transaction${count === 1 ? '' : 's'}`,
    totalStr: formatMoney(total, inputs.base),
    list: {
      ...list,
      emptyTitle: 'No transactions left here',
      emptyText: 'Nothing in this period is filed under this category now.',
    },
  }
}
