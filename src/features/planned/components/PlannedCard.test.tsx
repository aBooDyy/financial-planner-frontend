// @vitest-environment jsdom
import type { ReactNode } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPlannedList } from '#/features/planned/data/views'
import { indexSettlements } from '#/features/planned/data/settle'
import { m, planned, RATES, wallet } from '#/features/planned/testing/fixtures'
import { PlannedCard } from './PlannedCard'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

const TODAY = '2026-09-24'
const MAIN = wallet({ id: 'w1', name: 'Main Checking' })

const viewOf = (rows: ReturnType<typeof planned>[]) =>
  buildPlannedList({
    planned: rows,
    nodes: [MAIN],
    index: indexSettlements([], []),
    rates: RATES,
    base: 'SAR',
    today: TODAY,
  })

const renderCard = (rows: ReturnType<typeof planned>[]) => {
  const handlers = {
    onOpen: vi.fn(),
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
  }
  render(
    <PlannedCard
      view={viewOf(rows)}
      loading={false}
      colorOf={() => '#EC4899'}
      busyId={null}
      {...handlers}
    />,
  )
  return handlers
}

describe('PlannedCard', () => {
  it('points to Goals when nothing is planned', () => {
    renderCard([])
    expect(screen.getByText('Nothing planned')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Go to Goals' }).getAttribute('href'),
    ).toBe('/goals')
  })

  it('lists due items under Needs confirming with Skip and Confirm', () => {
    const { onConfirm, onSkip, onOpen } = renderCard([
      planned({
        id: 'sep',
        goalId: 'umrah',
        name: 'Umrah trip',
        occurrence: '2026-09-01',
        walletId: 'w1',
      }),
    ])
    const due = screen.getByRole('region', { name: 'Needs confirming' })
    expect(within(due).getByText('Needs confirming · 1')).toBeTruthy()
    expect(within(due).getByText('Goal')).toBeTruthy()

    fireEvent.click(within(due).getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sep', oneTap: true }),
    )
    fireEvent.click(within(due).getByRole('button', { name: 'Skip' }))
    expect(onSkip).toHaveBeenCalledOnce()
    fireEvent.click(
      within(due).getByRole('button', { name: 'Open Umrah trip' }),
    )
    expect(onOpen).toHaveBeenCalledWith('sep')
  })

  it('sums the next 14 days and keeps those rows action-free', () => {
    renderCard([
      planned({
        role: 'income',
        origin: 'income',
        goalId: null,
        incomeStreamId: 's1',
        name: 'Salary',
        amount: m(12000),
        occurrence: '2026-09-27',
      }),
      planned({ goalId: 'umrah', occurrence: '2026-10-01' }),
    ])
    const next = screen.getByRole('region', { name: 'Planned · next 14 days' })
    expect(within(next).getByText('+SR 12,000.00 · −SR 1,500.00')).toBeTruthy()
    expect(within(next).queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(
      screen.queryByRole('region', { name: 'Needs confirming' }),
    ).toBeNull()
  })

  it('collapses later items until Show all', () => {
    renderCard([
      planned({
        goalId: 'umrah',
        occurrence: '2026-11-01',
        name: 'Nov set-aside',
      }),
      planned({
        goalId: 'umrah',
        occurrence: '2026-12-01',
        name: 'Dec set-aside',
      }),
    ])
    expect(screen.getByText('Later in November')).toBeTruthy()
    expect(screen.queryByText('Nov set-aside')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '2 more · Show all' }))
    expect(screen.getByText('Nov set-aside')).toBeTruthy()
    expect(screen.getByText('Dec set-aside')).toBeTruthy()
    expect(screen.getByText('Later in November')).toBeTruthy()
    expect(screen.getByText('December')).toBeTruthy()
  })
})
