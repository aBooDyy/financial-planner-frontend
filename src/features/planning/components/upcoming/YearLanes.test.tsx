// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { YearAhead, YearMonth } from '#/features/planning/data/yearAhead'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { bill, goal, m } from '#/features/planned/testing/fixtures'
import { stubBrowser } from '#/features/planning/testing/dom'
import { YearLanes } from './YearLanes'

beforeAll(stubBrowser)
afterEach(cleanup)

const rent = bill({ id: 'rent', name: 'Rent', amount: m(3000) })
const car = goal({ id: 'car', name: 'Car', target: m(13000) })
const calendar: PayCalendar = { kind: 'month', perYear: 12 }

const month = (key: string, over: Partial<YearMonth> = {}): YearMonth => ({
  month: key,
  income: m(12000),
  monthlyBills: {
    total: m(3000),
    items: [
      {
        billId: 'rent',
        occurrence: `${key}-01`,
        amount: m(3000),
        amountBase: m(3000),
      },
    ],
  },
  bigBills: [],
  goalTargets: [],
  setAside: {
    total: m(1000),
    byOwner: [
      { kind: 'goal', ownerId: 'car', color: car.color, amount: m(1000) },
    ],
  },
  ...over,
})

const ahead: YearAhead = {
  months: ['2026-10', '2026-11', '2026-12', '2027-01'].map((k) => month(k)),
  ramps: [],
  goals: [
    {
      goalId: 'car',
      from: '2026-10-25',
      finish: null,
      target: null,
      slips: false,
      slipsTo: null,
      paused: false,
      perPaycheck: m(1000),
    },
  ],
}

function renderLanes() {
  return render(
    <YearLanes
      ahead={ahead}
      bills={[rent]}
      goals={[car]}
      base="SAR"
      calendar={calendar}
      onOpen={vi.fn()}
      onReview={vi.fn()}
    />,
  )
}

describe('year lanes', () => {
  it('tints the current month column for the full height', () => {
    const { container } = renderLanes()
    const guide = container.querySelector<HTMLElement>(
      '[aria-hidden].bg-fp-accent-soft',
    )
    const rows = Math.max(
      ...[...container.querySelectorAll<HTMLElement>('[style*="grid-row"]')]
        .map((el) => Number(el.style.gridRow.split('/')[0]))
        .filter(Number.isFinite),
    )
    expect(guide?.style.gridColumn).toBe('2')
    expect(guide?.style.gridRow).toBe(`1 / ${rows + 1}`)
  })
})
