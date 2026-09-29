import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  parseISO,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import {
  offeredScope,
  scopeFromValue,
  scopeSections,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { readSpans, reportRange } from '#/features/reports/data/range'
import { ledgerKey, readReportLedger } from '#/features/reports/data/reads'
import { buildReport } from '#/features/reports/data/report'
import type { ReportView } from '#/features/reports/data/report'
import type { ReportControls } from './useReportControls'

const NO_DELTAS: Record<string, number> = {}

/**
 * The report for the chosen period, comparison and accounts. Only the period's and the
 * comparison's rows are read; everything before the period arrives as one balance per
 * wallet. While a new period loads, the last report stays on screen rather than blanking.
 */
export function useReport(controls: ReportControls) {
  const { loading, base, inputs, deltas, catalog } = useTransactions()
  const todayKey = ymd(startOfToday())
  const { preset, comparison } = controls
  const { start: customStart, end: customEnd } = controls.custom

  const range = useMemo(
    () =>
      reportRange(
        preset,
        { start: customStart, end: customEnd },
        comparison,
        parseISO(todayKey),
      ),
    [preset, customStart, customEnd, comparison, todayKey],
  )
  const spans = readSpans(range)
  const key = ledgerKey(spans)
  const periodStart = ymd(range.start)
  const { rates, nodes } = inputs

  const ledger = useLiveQuery(
    () => (loading ? undefined : readReportLedger(spans, periodStart, rates)),
    [loading, key, periodStart, rates],
  )

  const sections = useMemo(
    () => scopeSections(inputs, deltas ?? NO_DELTAS),
    [inputs, deltas],
  )
  const chosen = scopeToValue(controls.scope)
  const scopeValue = loading
    ? chosen
    : scopeToValue(offeredScope(sections, scopeFromValue(chosen)))
  const scope = useMemo(() => scopeFromValue(scopeValue), [scopeValue])

  const fresh = useMemo(
    (): ReportView | null =>
      ledger && ledger.key === key
        ? buildReport({
            ledger,
            nodes,
            scope,
            range,
            today: parseISO(todayKey),
            catalog,
            base,
            rates,
          })
        : null,
    [ledger, key, nodes, scope, range, todayKey, catalog, base, rates],
  )
  const [shown, setShown] = useState<ReportView | null>(null)
  if (fresh && fresh !== shown) setShown(fresh)

  return {
    range,
    today: parseISO(todayKey),
    view: fresh ?? shown,
    sections,
    scope,
    balancesLoading: loading || !deltas,
  }
}
