// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { LocalPlanned } from '#/db/types'
import { buildForecast } from '#/features/planned/data/forecast'
import { indexSettlements } from '#/features/planned/data/settle'
import { buildPlannedList } from '#/features/planned/data/views'
import { RATES, m, planned } from '#/features/planned/testing/fixtures'
import { ForecastCard } from './ForecastCard'

afterEach(cleanup)

const TODAY = '2026-09-27'

const bill = (name: string, occurrence: string, amount: number) =>
  planned({
    origin: 'bill',
    role: 'payment',
    goalId: null,
    name,
    occurrence,
    amount,
  })

function viewOf(rows: LocalPlanned[], balance: number, reserved = 0) {
  const list = buildPlannedList({
    planned: rows,
    nodes: [],
    index: indexSettlements([], []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })
  return buildForecast({
    rows: [...list.due, ...list.next, ...list.later],
    balance,
    reserved,
    base: 'SAR',
    rates: RATES,
    today: TODAY,
  })
}

describe('ForecastCard', () => {
  const view = viewOf([bill('Rent', '2026-10-01', m(4000))], m(5000), m(2000))

  it('rests on the lowest day and says what comes of it', () => {
    render(<ForecastCard view={view} />)
    expect(screen.getByText('Lowest · Oct 1')).toBeTruthy()
    expect(screen.getByText('Dips into goal money on Oct 1')).toBeTruthy()
    expect(screen.getByText('Goal money')).toBeTruthy()
    expect(screen.queryByText('Zero')).toBeNull()
  })

  it('steps day by day with the arrow keys and returns on Escape', () => {
    render(<ForecastCard view={view} />)
    const chart = screen.getByRole('slider')
    expect(chart.getAttribute('aria-valuetext')).toBe('Oct 1: SR 1,000')

    fireEvent.keyDown(chart, { key: 'Home' })
    expect(chart.getAttribute('aria-valuetext')).toBe('Today: SR 5,000')
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(chart.getAttribute('aria-valuetext')).toBe('Tomorrow: SR 5,000')
    expect(screen.getByText('Nothing lands')).toBeTruthy()

    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(screen.getByText('Lowest · Oct 1')).toBeTruthy()
  })

  it('draws the zero line only when the balance goes below it', () => {
    render(
      <ForecastCard
        view={viewOf([bill('Rent', '2026-10-01', m(6000))], m(5000))}
      />,
    )
    expect(screen.getByText('Goes below zero on Oct 1')).toBeTruthy()
    expect(screen.getByText('Zero')).toBeTruthy()
  })

  it('says the balance holds when nothing lands', () => {
    render(<ForecastCard view={viewOf([], m(5000))} />)
    expect(screen.getByText('No bills or paydays soon')).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows a skeleton while loading', () => {
    render(<ForecastCard view={null} />)
    expect(screen.getByText('Balance ahead')).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
  })
})
