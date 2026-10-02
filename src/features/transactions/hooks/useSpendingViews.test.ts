// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalBudget, LocalTransaction } from '#/db/types'
import { defaultCatalog } from '#/features/categories/__fixtures__/categories'
import type { SpendingView } from '#/features/transactions/constants'
import type { LedgerWindow } from '#/features/transactions/data/ledgerReads'
import type { IsoPeriod } from '#/features/transactions/data/planning'
import * as selectors from '#/features/transactions/data/selectors'
import type {
  Scope,
  SpendingInputs,
} from '#/features/transactions/data/selectors'
import { useSpendingViews } from './useSpendingViews'

vi.mock('#/features/transactions/data/selectors', async (importOriginal) => {
  const real = await importOriginal<typeof selectors>()
  return {
    ...real,
    buildCashflow: vi.fn(real.buildCashflow),
    buildCalendar: vi.fn(real.buildCalendar),
    buildActivityList: vi.fn(real.buildActivityList),
    buildBreakdown: vi.fn(real.buildBreakdown),
    buildBudgetsView: vi.fn(real.buildBudgetsView),
  }
})

const BUILDERS = [
  'buildCashflow',
  'buildCalendar',
  'buildActivityList',
  'buildBreakdown',
  'buildBudgetsView',
] as const

const calls = () =>
  Object.fromEntries(
    BUILDERS.map((name) => [
      name,
      vi.mocked(selectors[name]).mock.calls.length,
    ]),
  )

const INPUTS: SpendingInputs = {
  budgets: [],
  nodes: [],
  base: 'SAR',
  rates: { SAR: 1 },
  setAsides: [],
  goals: [],
}
const ROWS: LocalTransaction[] = []
const SEPTEMBER: IsoPeriod = {
  mode: 'month',
  start: '2026-09-01',
  end: '2026-09-30',
}
const LEDGER: LedgerWindow = {
  period: SEPTEMBER,
  today: '2026-09-26',
  budgets: [],
  payCalendar: { kind: 'month', perYear: 12 },
  rows: ROWS,
}
const CATALOG = defaultCatalog()

type Props = {
  view: SpendingView
  period: IsoPeriod
  ledger: LedgerWindow | undefined
  calOpen: boolean
  scope: Scope
}

const render = (initial: Props) =>
  renderHook(
    (p: Props) =>
      useSpendingViews({
        ...p,
        inputs: INPUTS,
        catalog: CATALOG,
        today: '2026-09-26',
        dateFormat: 'dmy',
      }),
    { initialProps: initial },
  )

const ACTIVITY: Props = {
  view: 'activity',
  period: SEPTEMBER,
  ledger: LEDGER,
  calOpen: false,
  scope: { type: 'all' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSpendingViews', () => {
  it('builds only what the active tab shows', () => {
    render(ACTIVITY)
    expect(calls()).toEqual({
      buildCashflow: 1,
      buildCalendar: 1,
      buildActivityList: 1,
      buildBreakdown: 1,
      buildBudgetsView: 0,
    })
    vi.clearAllMocks()
    render({ ...ACTIVITY, view: 'budgets' })
    expect(calls()).toMatchObject({ buildCashflow: 0, buildBudgetsView: 1 })
  })

  it('rebuilds nothing on an unrelated render, and only the calendar when it unfolds', () => {
    const { result, rerender } = render(ACTIVITY)
    const first = result.current.activity
    vi.clearAllMocks()

    // A fresh scope object with the same meaning is not a change.
    rerender({ ...ACTIVITY, scope: { type: 'all' } })
    expect(calls()).toMatchObject({ buildCashflow: 0, buildCalendar: 0 })
    expect(result.current.activity?.list).toBe(first?.list)

    rerender({ ...ACTIVITY, calOpen: true })
    expect(calls()).toMatchObject({ buildCashflow: 0, buildCalendar: 1 })
  })

  it('measures budgets from the ledger snapshot, never a newer list than its rows', () => {
    const wide: LocalBudget = {
      id: 'wide',
      scopeType: 'overall',
      categoryId: null,
      walletId: null,
      period: 'custom',
      customDays: 400,
      limit: 100,
      currency: 'SAR',
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    }
    // The budget list has landed but the rows for its wider span have not.
    const { result, rerender } = renderHook(
      (ledger: LedgerWindow) =>
        useSpendingViews({
          ...ACTIVITY,
          view: 'budgets',
          ledger,
          inputs: { ...INPUTS, budgets: [wide] },
          catalog: CATALOG,
          today: '2026-09-26',
          dateFormat: 'dmy',
        }),
      { initialProps: LEDGER },
    )
    expect(result.current.budgets?.rows).toEqual([])
    rerender({ ...LEDGER, budgets: [wide] })
    expect(result.current.budgets?.rows.map((r) => r.id)).toEqual(['wide'])
  })

  it('while the ledger loads, lays out the asked-for period with no figures; schedules do not wait', () => {
    const { result } = render({
      ...ACTIVITY,
      period: { mode: 'month', start: '2025-03-01', end: '2025-03-31' },
      ledger: undefined,
    })
    expect(result.current.activity).toMatchObject({
      cashflow: null,
      list: null,
      breakdown: null,
    })
    expect(result.current.activity?.calendar.grid).toBe('days')
    expect(result.current.period).toEqual({
      mode: 'month',
      start: '2025-03-01',
      end: '2025-03-31',
      label: 'March 2025',
      todayIs: 'ahead',
    })
  })

  it('keeps showing the loaded period while the page asks for the next one', () => {
    const { result, rerender } = render(ACTIVITY)
    const shown = result.current.activity
    vi.clearAllMocks()
    rerender({
      ...ACTIVITY,
      period: { mode: 'month', start: '2026-10-01', end: '2026-10-31' },
    })
    expect(result.current.period.label).toBe('September 2026')
    expect(result.current.activity?.list).toBe(shown?.list)
    expect(calls()).toMatchObject({ buildCashflow: 0, buildCalendar: 0 })
  })
})
