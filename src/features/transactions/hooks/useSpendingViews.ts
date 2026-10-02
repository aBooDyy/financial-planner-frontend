import { useMemo } from 'react'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type {
  PeriodMode,
  SpendingView,
} from '#/features/transactions/constants'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import type { LedgerWindow } from '#/features/transactions/data/ledgerReads'
import {
  fromIsoPeriod,
  parseISO,
  todayRelativeTo,
  ymd,
} from '#/features/transactions/data/planning'
import type { IsoPeriod, Period } from '#/features/transactions/data/planning'
import {
  buildActivityList,
  buildBreakdown,
  buildBudgetsView,
  buildCalendar,
  buildCashflow,
  periodCaption,
  scopeFromValue,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import type {
  Scope,
  SpendingData,
  SpendingInputs,
} from '#/features/transactions/data/selectors'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import type { DateFormat } from '#/lib/date'

type Args = {
  view: SpendingView
  /** The period the page asks for — shown until the first rows for it land. */
  period: IsoPeriod
  /** `null` while the non-ledger inputs are still loading. */
  inputs: SpendingInputs | null
  ledger: LedgerWindow | undefined
  catalog: CategoryCatalog
  scope: Scope
  calOpen: boolean
  today: string
  dateFormat: DateFormat
}

/** The period on screen, as its header draws it. */
export type PeriodOnScreen = IsoSpan & {
  mode: PeriodMode
  label: string
  /** Where today sits relative to the period; `null` while it's inside it. */
  todayIs: 'ahead' | 'behind' | null
}

/** The period on screen and, once they have landed, the rows read for it. */
type Shown = {
  period: Period
  today: Date
  data: SpendingData | null
}

// Lays out the calendar's days before any figure has loaded; its values are never drawn.
const NO_DATA: SpendingData = {
  txns: [],
  budgets: [],
  nodes: [],
  base: DEFAULT_BASE_CURRENCY,
  rates: {},
}

/**
 * The Spending views, each built only for the tab that shows it and memoized on its own
 * inputs; a data view is `null` while it loads. Ledger-backed views are built for the period
 * the rows were read for, so stepping periods keeps the last one on screen until the next
 * lands. `period` and the calendar's layout exist from the first render, since they derive
 * from the period alone.
 */
export function useSpendingViews({
  view,
  period: asked,
  inputs,
  ledger,
  catalog,
  scope: chosen,
  calOpen,
  today,
  dateFormat,
}: Args) {
  const scopeKey = scopeToValue(chosen)
  const scope = useMemo(() => scopeFromValue(scopeKey), [scopeKey])

  // Two memos, so a loaded period keeps its identity while the page asks for the next one.
  const loaded = useMemo(
    (): Shown | null =>
      inputs && ledger
        ? {
            period: fromIsoPeriod(ledger.period),
            today: parseISO(ledger.today),
            data: {
              ...inputs,
              budgets: ledger.budgets,
              payCalendar: ledger.payCalendar,
              txns: ledger.rows,
            },
          }
        : null,
    [inputs, ledger],
  )
  const requested = useMemo(
    (): Shown => ({
      period: fromIsoPeriod({
        mode: asked.mode,
        start: asked.start,
        end: asked.end,
      }),
      today: parseISO(today),
      data: null,
    }),
    [asked.mode, asked.start, asked.end, today],
  )
  const shown = loaded ?? requested

  const period = useMemo(
    (): PeriodOnScreen => ({
      mode: shown.period.mode,
      start: ymd(shown.period.start),
      end: ymd(shown.period.end),
      label: periodCaption(shown.period, dateFormat),
      todayIs: todayRelativeTo(shown.period, shown.today),
    }),
    [shown, dateFormat],
  )

  const onActivity = view === 'activity'
  const activity = onActivity ? shown.data : null

  const calendar = useMemo(
    () =>
      onActivity
        ? buildCalendar(
            shown.data ?? NO_DATA,
            scope,
            shown.period,
            calOpen,
            shown.today,
            dateFormat,
          )
        : null,
    [onActivity, shown, scope, calOpen, dateFormat],
  )
  const cashflow = useMemo(
    () =>
      activity &&
      buildCashflow(activity, catalog, scope, shown.period, dateFormat),
    [activity, shown, catalog, scope, dateFormat],
  )
  const list = useMemo(
    () =>
      activity &&
      buildActivityList(
        activity,
        catalog,
        scope,
        shown.period,
        shown.today,
        dateFormat,
      ),
    [activity, shown, catalog, scope, dateFormat],
  )
  const breakdown = useMemo(
    () =>
      activity &&
      buildBreakdown(activity, catalog, scope, shown.period, dateFormat),
    [activity, shown, catalog, scope, dateFormat],
  )

  const budgets = useMemo(
    () =>
      view === 'budgets' && shown.data
        ? buildBudgetsView(shown.data, catalog, scope, shown.today)
        : null,
    [view, shown, catalog, scope],
  )
  return {
    period,
    activity: calendar ? { calendar, cashflow, list, breakdown } : null,
    budgets,
  }
}
