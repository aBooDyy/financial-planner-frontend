// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import { m } from '#/features/planned/testing/fixtures'
import { buildNeedsWants } from '#/features/reports/data/needsWantsCard'
import { reportRange } from '#/features/reports/data/range'
import {
  CAFES,
  DINING,
  GROCERIES,
  OTHER,
  SALARY,
  flow,
  reportCatalog,
} from '#/features/reports/testing/fixtures'
import { NeedsWantsCard } from './NeedsWantsCard'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const TODAY = new Date(2026, 8, 29)

const view = buildNeedsWants({
  cur: [
    flow({ type: 'income', categoryId: SALARY, amount: m(10_000) }),
    flow({ categoryId: GROCERIES, amount: m(4_800) }),
    flow({ categoryId: CAFES, amount: m(3_100) }),
    flow({ categoryId: OTHER, amount: m(100) }),
  ],
  prev: null,
  goalSetAside: m(900),
  range: reportRange('this_month', { start: '', end: '' }, 'none', TODAY),
  today: TODAY,
  catalog: reportCatalog(),
  base: 'SAR',
})

const renderCard = (props: Partial<Parameters<typeof NeedsWantsCard>[0]>) =>
  render(
    <TooltipProvider>
      <NeedsWantsCard
        view={view}
        onViewCategory={vi.fn()}
        onSort={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  )

describe('NeedsWantsCard', () => {
  it('reads each bucket against its guideline, and what went to goals', () => {
    renderCard({})
    expect(screen.getByText('of SR 10,000 income')).toBeTruthy()
    expect(screen.getByText('guideline ≤ 50%')).toBeTruthy()
    expect(screen.getByLabelText('a little over')).toBeTruthy()
    expect(screen.getByText(/SR 900 set aside for goals/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Needs: SR 4,800, 48%' }),
    ).toBeTruthy()
  })

  it('opens a bucket onto its categories and hands a pick back', () => {
    const onViewCategory = vi.fn()
    renderCard({ onViewCategory })
    fireEvent.click(
      screen.getByRole('button', { name: /^Wants/, expanded: false }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Dining, view transactions/ }),
    )
    expect(onViewCategory).toHaveBeenCalledWith('want', DINING)
  })

  it('offers to sort the categories not sorted yet', () => {
    const onSort = vi.fn()
    renderCard({ onSort })
    fireEvent.click(screen.getByRole('button', { name: 'Sort 1 category' }))
    expect(onSort).toHaveBeenCalledWith([OTHER])
  })

  it('keeps its heading while the period loads', () => {
    renderCard({ view: null })
    expect(screen.getByText('Needs, wants, savings')).toBeTruthy()
    expect(screen.queryByText('guideline ≤ 50%')).toBeNull()
  })
})
