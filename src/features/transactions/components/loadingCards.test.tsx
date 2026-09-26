// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { buildCalendar } from '#/features/transactions/data/selectors'
import { BreakdownCard } from './BreakdownCard'
import { BudgetHealthCard, BudgetsCard } from './BudgetsCard'
import { CashflowHeroCard } from './CashflowHeroCard'
import { DaysCard } from './DaysCard'
import { RecurringCard, UpcomingCard } from './RecurringCard'
import { TransactionList } from './TransactionList'

/**
 * While the figures load, every card renders for real — frame, headings, labels, actions —
 * and only the data-driven parts stand in as skeletons. No zero is ever drawn.
 */

afterEach(cleanup)

const noop = () => {}

const placeholders = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="skeleton"]').length

/** A figure a loaded card would print: any digit (the calendar's day numbers aside). */
const hasFigure = (text: string | null) => /\d/.test(text ?? '')

const mount = (card: ReactElement) => render(card).container

describe('loading cards', () => {
  it('the cashflow hero keeps its labels and period, with skeleton figures', () => {
    const el = mount(<CashflowHeroCard view={null} periodLabel="March 2025" />)
    for (const label of ['Cashflow', '· March 2025', 'Income', 'Spent', 'Net'])
      expect(screen.getByText(label)).toBeTruthy()
    expect(screen.queryByText('Saved')).toBeNull()
    expect(placeholders(el)).toBeGreaterThanOrEqual(5)
    expect(hasFigure(el.textContent.replace('2025', ''))).toBe(false)
  })

  it('the transaction list keeps its header and Add, with placeholder rows', () => {
    const el = mount(
      <TransactionList view={null} onAdd={noop} onRowClick={noop} />,
    )
    expect(screen.getByText('Transactions')).toBeTruthy()
    expect(screen.getByRole('button', { name: /add/i })).toBeTruthy()
    // The count, then five rows of chip, two lines and an amount.
    expect(placeholders(el)).toBe(1 + 5 * 4)
    expect(hasFigure(el.textContent)).toBe(false)
  })

  it('the breakdown keeps its heading and period, with a skeleton donut', () => {
    const el = mount(<BreakdownCard view={null} periodLabel="Week" />)
    expect(screen.getByText('Where it went')).toBeTruthy()
    expect(screen.queryByText('No spending yet')).toBeNull()
    expect(placeholders(el)).toBe(4)
  })

  it('budgets keep their header, actions and labels, never an empty state', () => {
    const list = mount(<BudgetsCard view={null} onAdd={noop} onEdit={noop} />)
    expect(screen.getByText('Budgets')).toBeTruthy()
    expect(screen.getByRole('button', { name: /new budget/i })).toBeTruthy()
    expect(screen.queryByText('No budgets yet')).toBeNull()
    expect(hasFigure(list.textContent)).toBe(false)

    const health = mount(<BudgetHealthCard view={null} onAdd={noop} />)
    for (const label of ['Budget health', 'on track', 'over limit'])
      expect(screen.getByText(label)).toBeTruthy()
    expect(placeholders(health)).toBeGreaterThanOrEqual(4)
    expect(hasFigure(health.textContent)).toBe(false)
  })

  it('recurring keeps its header and actions, with placeholder rows', () => {
    const list = mount(<RecurringCard view={null} onAdd={noop} onEdit={noop} />)
    expect(screen.getByRole('button', { name: /new recurring/i })).toBeTruthy()
    expect(screen.queryByText('No recurring items yet')).toBeNull()
    expect(hasFigure(list.textContent)).toBe(false)

    const upcoming = mount(<UpcomingCard view={null} onAdd={noop} />)
    expect(screen.getByText('Upcoming this month')).toBeTruthy()
    expect(screen.queryByText('Nothing else due this month')).toBeNull()
    expect(placeholders(upcoming)).toBe(2 * 4)
  })

  it('the calendar draws its days and working controls, with no figure in any cell', () => {
    const calendar = buildCalendar(
      {
        txns: [],
        budgets: [],
        recurrings: [],
        nodes: [],
        base: 'SAR',
        rates: {},
      },
      { type: 'all' },
      new Date(2025, 2, 1),
      'month',
      false,
      new Date(2026, 8, 26),
    )
    const el = mount(
      <DaysCard
        calendar={calendar}
        loading
        mode="month"
        periodLabel="March 2025"
        calOpen={false}
        onSetMode={noop}
        onPrev={noop}
        onNext={noop}
        todayIs="ahead"
        onToday={noop}
        onToggleCal={noop}
        onPickDay={noop}
        onPickMonth={noop}
      />,
    )
    for (const mode of ['Year', 'Month', 'Week', 'Day'])
      expect(screen.getByRole('button', { name: mode })).toBeTruthy()
    expect(screen.getByText('March 2025')).toBeTruthy()
    expect(screen.getByRole('button', { name: /today/i })).toBeTruthy()
    const cells = el.querySelectorAll('button[aria-pressed]')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.querySelector('[data-slot="skeleton"]')).not.toBeNull()
      expect(cell.textContent).toMatch(/^\d{1,2}$/)
    }
  })
})
