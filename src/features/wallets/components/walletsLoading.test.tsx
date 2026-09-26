// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import { buildWalletsView } from '#/features/wallets/data/selectors'
import { BalanceNowStrip } from './BalanceNowStrip'
import { CurrencyBreakdownCard } from './CurrencyBreakdownCard'
import { TotalHeroCard } from './TotalHeroCard'
import { WalletsGroupsCard } from './WalletsGroupsCard'

/**
 * While the balances load, the Wallets page draws its cards and the whole tree — names,
 * icons, counts, actions — and holds back every figure. The view here is the one `useWallets`
 * builds in that state: the nodes with no deltas and no reservations, so its figures are the
 * opening balances, which must never reach the screen.
 */

afterEach(cleanup)

const noop = () => {}

const node = (
  over: Partial<LocalBalanceNode> & { id: string },
): LocalBalanceNode => ({
  kind: 'wallet',
  parentId: null,
  name: over.id,
  color: '#1F9D6B',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 123_456,
  currency: 'SAR',
  createdAt: '',
  updatedAt: '',
  version: '',
  dirty: 0,
  deleted: 0,
  ...over,
})

const VIEW = buildWalletsView(
  [
    node({ id: 'Bank', kind: 'group', amount: null, currency: null }),
    node({ id: 'Checking', parentId: 'Bank' }),
    node({ id: 'Dollars', currency: 'USD', amount: 50_000, position: 1 }),
  ],
  'SAR',
  { SAR: 1, USD: 3.75 },
  {},
  {},
)

const skeletons = (el: HTMLElement) =>
  el.querySelectorAll('[data-slot="skeleton"]').length

/** Any money figure: a digit run with a decimal part, or the SAR symbol. */
const hasMoney = (el: HTMLElement) => /\d\.\d\d|SR\s?\d/.test(el.textContent)

describe('Wallets while the balances load', () => {
  it('the hero keeps its title, base and counts, and no total', () => {
    const { container } = render(
      <TotalHeroCard view={VIEW} loading base="SAR" />,
    )
    expect(screen.getByText('Total liquid cash')).toBeTruthy()
    expect(screen.getByText('SAR')).toBeTruthy()
    expect(screen.getByText(/2 wallets/)).toBeTruthy()
    expect(hasMoney(container)).toBe(false)
    expect(skeletons(container)).toBeGreaterThanOrEqual(2)
  })

  it('the tree draws every group and wallet with its actions, and no balance', () => {
    const { container } = render(
      <WalletsGroupsCard
        rows={VIEW.rows}
        loading
        onAddWallet={noop}
        onAddGroup={noop}
        onToggle={noop}
        onEdit={noop}
        onAdjust={noop}
        onDelete={noop}
        onAddInside={noop}
        onOpenGoal={noop}
        archivedCount={0}
      />,
    )
    for (const name of ['Bank', 'Checking', 'Dollars'])
      expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add wallet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /new group/i })).toBeTruthy()
    expect(hasMoney(container)).toBe(false)
    // One per row: the group's subtotal and each wallet's balance.
    expect(skeletons(container)).toBe(VIEW.rows.length)
  })

  it('the currency split lists each currency, and no share or sum', () => {
    const { container } = render(
      <CurrencyBreakdownCard breakdown={VIEW.breakdown} loading base="SAR" />,
    )
    expect(screen.getByText('By currency')).toBeTruthy()
    expect(screen.getByText('USD')).toBeTruthy()
    expect(hasMoney(container)).toBe(false)
    expect(container.textContent).not.toMatch(/%/)
  })

  it('the editor strip keeps its label and action, not a balance', () => {
    const { container } = render(
      <BalanceNowStrip balance={null} onAdjust={noop} />,
    )
    expect(screen.getByText('BALANCE NOW')).toBeTruthy()
    expect(screen.getByRole('button', { name: /adjust balance/i })).toBeTruthy()
    expect(skeletons(container)).toBe(1)
  })
})
