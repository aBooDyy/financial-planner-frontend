// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BillsYear } from '#/features/planning/data/billsYear'
import { m } from '#/features/planned/testing/fixtures'
import { YearOfBillsCard } from './YearOfBillsCard'

const months = Array.from({ length: 12 }, (_, i) => ({
  month: `2027-${String(i + 1).padStart(2, '0')}`,
  amount: i === 3 ? m(7000) : m(3000),
}))

const year = (over: Partial<BillsYear> = {}): BillsYear => ({
  months,
  total: m(40000),
  perMonth: m(40000) / 12,
  niceToHave: 0,
  income: m(144000),
  estimated: false,
  ...over,
})

const draw = (y: BillsYear | null, onSection = vi.fn()) =>
  render(<YearOfBillsCard year={y} base="SAR" onSection={onSection} />)

afterEach(cleanup)

describe('YearOfBillsCard', () => {
  it('shows the month and year figures and names the window', () => {
    draw(year())
    expect(screen.getByText('Jan 2027 – Dec 2027')).toBeTruthy()
    expect(screen.getByText('SR 3,333')).toBeTruthy()
    expect(screen.getAllByText('SR 40,000').length).toBe(2)
  })

  it('reads out the heaviest month until another is tapped', () => {
    draw(year())
    expect(screen.getByText(/Heaviest month · Apr 2027/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Feb 2027/ }))
    expect(screen.queryByText(/Heaviest month/)).toBeNull()
    expect(
      screen
        .getByRole('button', { name: /^Feb 2027/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('shows what is left of the income, and when bills outrun it', () => {
    const { unmount } = draw(year())
    expect(screen.getByText('SR 104,000')).toBeTruthy()
    expect(screen.getByText(/28% of income/)).toBeTruthy()
    unmount()
    draw(year({ income: m(30000) }))
    expect(screen.getByText('−SR 10,000').className).toContain('text-fp-danger')
  })

  it('leaves the income rows out when there is no income', () => {
    draw(year({ income: 0 }))
    expect(screen.queryByText('Left after bills')).toBeNull()
  })

  it('opens the bills section from its row', () => {
    const onSection = vi.fn()
    draw(year(), onSection)
    fireEvent.click(screen.getByRole('button', { name: /^Bills/ }))
    expect(onSection).toHaveBeenCalledWith('bills')
  })

  it('warns when the total rests on estimates', () => {
    draw(year({ estimated: true }))
    expect(screen.getByText(/Some bills are estimates/)).toBeTruthy()
  })

  it('draws its heading with no figures while loading', () => {
    draw(null)
    expect(screen.getByText('Your bills over a year')).toBeTruthy()
    expect(screen.queryByText('Left after bills')).toBeNull()
  })

  it('draws nothing when no bill falls in the year', () => {
    const { container } = draw(year({ total: 0 }))
    expect(container.firstChild).toBeNull()
  })
})
