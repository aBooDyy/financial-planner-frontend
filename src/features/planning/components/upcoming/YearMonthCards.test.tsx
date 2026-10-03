// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { YearMonth } from '#/features/planning/data/yearAhead'
import { goal, m } from '#/features/planned/testing/fixtures'
import { YearMonthCards } from './YearMonthCards'

afterEach(cleanup)

const car = goal({ id: 'car', name: 'Car' })

const month = (key: string, setAside: number): YearMonth => ({
  month: key,
  income: 0,
  monthlyBills: { total: 0, items: [] },
  bigBills: [],
  goalTargets: [],
  setAside: {
    total: setAside,
    byOwner: [
      { kind: 'goal', ownerId: 'car', color: car.color, amount: setAside },
    ],
  },
})

describe('year month cards', () => {
  it("scales each month's set-aside bar to the largest month", () => {
    render(
      <YearMonthCards
        ahead={{
          months: [month('2026-10', m(1000)), month('2026-11', m(250))],
          ramps: [],
          goals: [],
        }}
        bills={[]}
        goals={[car]}
        base="SAR"
        onOpen={vi.fn()}
      />,
    )
    const fill = (name: string) =>
      screen
        .getByRole('region', { name })
        .querySelector<HTMLElement>('.bg-fp-surface-2 > span')
    expect(fill('Oct 2026')?.style.flexBasis).toBe('100%')
    expect(fill('Nov')?.style.flexBasis).toBe('25%')
  })
})
