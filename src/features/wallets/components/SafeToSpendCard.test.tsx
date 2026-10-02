// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SafeToSpend } from '#/features/planning/data/safeToSpend'
import { safeHeaderView } from '#/features/wallets/data/safeHeader'
import { buildWalletsView } from '#/features/wallets/data/selectors'
import { SafeToSpendCard } from './SafeToSpendCard'

afterEach(cleanup)

const media = (desktop: boolean) => {
  window.matchMedia = (query: string) =>
    ({
      matches: desktop,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
}

const term = (total: number) => ({ total, items: [] })
const SAFE: SafeToSpend = {
  horizon: 'until_payday',
  end: '2026-10-24',
  payday: '2026-10-25',
  balance: 540_000,
  setAside: 190_000,
  free: 350_000,
  bills: term(65_000),
  setAsides: term(0),
  income: term(0),
  safe: 285_000,
  shortBy: 0,
}
const VIEW = buildWalletsView([], 'SAR', { SAR: 1 })

const renderCard = (safe: SafeToSpend = SAFE) => {
  const onLink = vi.fn()
  render(
    <SafeToSpendCard
      view={VIEW}
      header={safeHeaderView({
        safe,
        base: 'SAR',
        today: '2026-10-14',
        budgets: [
          {
            id: 'g',
            name: 'Groceries',
            left: 60_000,
            currency: 'SAR',
            windowLabel: 'this paycheck',
          },
        ],
      })}
      loading={false}
      base="SAR"
      onLink={onLink}
    />,
  )
  return onLink
}

describe('SafeToSpendCard', () => {
  it('shows the headline, its window, the sum and the budgets beside it', () => {
    media(true)
    const onLink = renderCard()
    expect(screen.getAllByText('SR 2,850.00')).toHaveLength(2)
    expect(screen.getByText('until payday · Oct 25')).toBeTruthy()
    expect(
      screen.getByText('Budgets left until payday: Groceries SR 600.00'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Set aside/ }))
    expect(onLink).toHaveBeenLastCalledWith('setAsides')
    fireEvent.click(screen.getByRole('button', { name: /Bills before payday/ }))
    expect(onLink).toHaveBeenLastCalledWith('upcoming')
  })

  it('reads red, with the shortfall, below zero', () => {
    media(true)
    renderCard({ ...SAFE, safe: -30_000, shortBy: 30_000 })
    expect(screen.getByText('SR 300.00 short before payday')).toBeTruthy()
  })

  it('folds the sum away on a phone until asked', () => {
    media(false)
    renderCard()
    expect(screen.queryByText('Balance')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /How it adds up/ }))
    expect(screen.getByText('Balance')).toBeTruthy()
  })
})
