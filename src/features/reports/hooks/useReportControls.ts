import { useNavigate, useSearch } from '@tanstack/react-router'
import type { IsoSpan } from '#/features/transactions/data/customRange'
import {
  scopeFromValue,
  scopeToValue,
} from '#/features/transactions/data/selectors'
import type { Scope } from '#/features/transactions/data/selectors'
import {
  DEFAULT_COMPARISON,
  DEFAULT_PRESET,
} from '#/features/reports/data/range'
import type { Comparison, RangePreset } from '#/features/reports/data/range'
import type { ReportsSearch } from '#/features/reports/data/search'

const NO_SPAN: IsoSpan = { start: '', end: '' }

export type ReportControls = {
  preset: RangePreset
  custom: IsoSpan
  comparison: Comparison
  scope: Scope
  setPreset: (preset: Exclude<RangePreset, 'custom'>) => void
  pickCustom: (span: IsoSpan) => void
  setComparison: (comparison: Comparison) => void
  setScope: (scope: Scope) => void
}

/** The report's period, comparison and accounts — read from and written to the URL. */
export function useReportControls(): ReportControls {
  const search = useSearch({ from: '/reports' })
  const navigate = useNavigate({ from: '/reports' })
  const update = (patch: Partial<ReportsSearch>) =>
    void navigate({ search: (s) => ({ ...s, ...patch }), replace: true })

  return {
    preset: search.range ?? DEFAULT_PRESET,
    custom:
      search.from && search.to
        ? { start: search.from, end: search.to }
        : NO_SPAN,
    comparison: search.compare ?? DEFAULT_COMPARISON,
    scope: scopeFromValue(search.accounts ?? ''),
    setPreset: (preset) =>
      update({
        range: preset === DEFAULT_PRESET ? undefined : preset,
        from: undefined,
        to: undefined,
      }),
    pickCustom: ({ start, end }) =>
      update({ range: 'custom', from: start, to: end }),
    setComparison: (comparison) =>
      update({
        compare: comparison === DEFAULT_COMPARISON ? undefined : comparison,
      }),
    setScope: (scope) =>
      update({
        accounts: scope.type === 'all' ? undefined : scopeToValue(scope),
      }),
  }
}
