// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BalanceRow } from '#/features/wallets/data/selectors'
import { WalletRow } from './WalletRow'

afterEach(cleanup)

const wallet = (over: Partial<BalanceRow> = {}): BalanceRow => ({
  id: 'w1',
  kind: 'wallet',
  depth: 0,
  name: 'Main Checking',
  color: '#1F9D6B',
  icon: 'wallet',
  note: null,
  collapsed: false,
  childCount: 0,
  childCountStr: '',
  amountStr: 'SR 10,000.00',
  isForeign: false,
  baseStr: '',
  subtotalStr: '',
  reserved: 0,
  available: 1_000_000,
  hasReserved: false,
  overReserved: false,
  reservedStr: 'SR 0.00',
  availableStr: 'SR 10,000.00',
  reservations: [],
  ...over,
})

const withPots = (over: Partial<BalanceRow> = {}) =>
  wallet({
    reserved: 506_700,
    available: 493_300,
    hasReserved: true,
    reservedStr: 'SR 5,067.00',
    availableStr: 'SR 4,933.00',
    reservations: [
      {
        goalId: 'umrah',
        goalName: 'Umrah trip',
        color: '#F59E0B',
        amountStr: 'SR 4,000.00',
      },
      {
        goalId: 'tuition',
        goalName: 'Tuition',
        color: '#8B5CF6',
        amountStr: 'SR 1,067.00',
      },
    ],
    ...over,
  })

const renderRow = (row: BalanceRow) => {
  const handlers = {
    onEdit: vi.fn(),
    onAdjust: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onOpenGoal: vi.fn(),
  }
  render(<WalletRow row={row} {...handlers} />)
  return handlers
}

describe('WalletRow', () => {
  it('leaves a wallet without reservations as it was', () => {
    renderRow(wallet())
    expect(screen.getByText('SR 10,000.00')).toBeDefined()
    expect(screen.queryByText(/in bank/)).toBeNull()
    expect(screen.queryByText('available')).toBeNull()
  })

  it('heads a wallet holding goal money with what is available', () => {
    renderRow(withPots())
    expect(screen.getByText('SR 4,933.00')).toBeDefined()
    expect(screen.getByText('available')).toBeDefined()
    expect(screen.getByText('SR 10,000.00 in bank')).toBeDefined()
  })

  it('lists its pots by default, each opening its goal', () => {
    const { onOpenGoal, onEdit } = renderRow(withPots())
    expect(screen.getByText('Umrah trip')).toBeDefined()
    expect(screen.getByText('SR 1,067.00')).toBeDefined()
    fireEvent.click(
      screen.getByRole('button', { name: /Open Tuition, SR 1,067.00/ }),
    )
    expect(onOpenGoal).toHaveBeenCalledWith('tuition')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('adjusts the balance from its own action without opening the editor', () => {
    const { onAdjust, onEdit } = renderRow(wallet())
    fireEvent.click(screen.getByRole('button', { name: 'Adjust balance' }))
    expect(onAdjust).toHaveBeenCalledWith(wallet().id)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('shows an over-reserved wallet in red', () => {
    renderRow(
      withPots({
        available: -50_000,
        overReserved: true,
        availableStr: '-SR 500.00',
      }),
    )
    expect(screen.getByText('over-reserved').className).toContain(
      'text-fp-danger',
    )
    expect(screen.getByText('-SR 500.00').className).toContain('text-fp-danger')
  })

  it('lets only the name give way when the row runs out of width', () => {
    renderRow(withPots({ isForeign: true, baseStr: '≈ SR 37,500.00' }))
    const figures = [
      screen.getByText('SR 4,933.00'),
      screen.getByText('SR 10,000.00 in bank'),
      screen.getByText('· ≈ SR 37,500.00'),
      screen.getByText('SR 1,067.00'),
    ]
    for (const el of figures) {
      expect(el.className).not.toContain('truncate')
      expect(el.className).toContain('whitespace-nowrap')
    }
    expect(screen.getByText('SR 4,933.00').className).toContain('shrink-0')
    expect(screen.getByText('SR 1,067.00').className).toContain('shrink-0')
    expect(screen.getByText('Main Checking').className).toContain('truncate')
  })
})
