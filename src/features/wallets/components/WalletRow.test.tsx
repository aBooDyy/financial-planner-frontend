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
  setAside: 0,
  free: 1_000_000,
  hasSetAside: false,
  overCommitted: false,
  setAsideStr: 'SR 0.00',
  freeStr: 'SR 10,000.00',
  overStr: 'SR 0.00 over',
  setAsideLines: [],
  ...over,
})

const holding = (over: Partial<BalanceRow> = {}) =>
  wallet({
    setAside: 506_700,
    free: 493_300,
    hasSetAside: true,
    setAsideStr: 'SR 5,067.00',
    freeStr: 'SR 4,933.00',
    setAsideLines: [
      {
        ownerId: 'umrah',
        owner: 'goal',
        ownerName: 'Umrah trip',
        color: '#F59E0B',
        amountStr: 'SR 4,000.00',
      },
      {
        ownerId: 'tuition',
        owner: 'bill',
        ownerName: 'Tuition',
        color: '#8B5CF6',
        amountStr: 'SR 1,000.00',
      },
      {
        ownerId: 'gym',
        owner: 'bill',
        ownerName: 'Gym',
        color: '#06B6D4',
        amountStr: 'SR 67.00',
      },
    ],
    ...over,
  })

const renderRow = (
  row: BalanceRow,
  { loading = false, expanded = false } = {},
) => {
  const handlers = {
    onEdit: vi.fn(),
    onAdjust: vi.fn(),
    onDelete: vi.fn(),
    onSetAside: vi.fn(),
    onOpenLine: vi.fn(),
    onToggleLines: vi.fn(),
  }
  render(
    <WalletRow row={row} loading={loading} expanded={expanded} {...handlers} />,
  )
  return handlers
}

describe('WalletRow', () => {
  it('names a wallet at once and holds its balance back until it has loaded', () => {
    renderRow(wallet({ isForeign: true, baseStr: 'SR 3.75' }), {
      loading: true,
    })
    expect(screen.getByText('Main Checking')).toBeDefined()
    expect(screen.queryByText('SR 10,000.00')).toBeNull()
    expect(screen.queryByText('SR 3.75')).toBeNull()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it('shows only the balance when nothing is set aside in it', () => {
    renderRow(wallet())
    expect(screen.getByText('SR 10,000.00')).toBeDefined()
    expect(screen.queryByText(/Set aside/)).toBeNull()
    expect(screen.queryByText(/Free to spend/)).toBeNull()
  })

  it('keeps the balance as the big figure and says what is set aside and free', () => {
    renderRow(holding())
    expect(screen.getByText('SR 10,000.00')).toBeDefined()
    expect(screen.getByText('Set aside SR 5,067.00')).toBeDefined()
    expect(screen.getByText('Free to spend SR 4,933.00')).toBeDefined()
    expect(screen.queryByText(/available|reserved/i)).toBeNull()
  })

  it('names the largest set-asides folded, and opens the list on a tap', () => {
    const { onToggleLines, onEdit } = renderRow(holding())
    const summary = screen.getByRole('button', {
      name: 'Umrah trip SR 4,000.00 · Tuition SR 1,000.00 · +1',
    })
    expect(summary.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(summary)
    expect(onToggleLines).toHaveBeenCalledWith('w1')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('lists every set-aside when open, each opening its bill or goal', () => {
    const { onOpenLine } = renderRow(holding(), { expanded: true })
    expect(screen.getByText('Gym')).toBeDefined()
    fireEvent.click(
      screen.getByRole('button', { name: /Open Tuition, SR 1,000.00/ }),
    )
    expect(onOpenLine).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'tuition', owner: 'bill' }),
    )
  })

  it('shows an over-committed wallet in red, by how much', () => {
    renderRow(
      holding({
        free: -50_000,
        overCommitted: true,
        overStr: 'SR 500.00 over',
      }),
    )
    const over = screen.getByText('SR 500.00 over')
    expect(over.parentElement?.className).toContain('text-fp-danger')
    expect(screen.queryByText(/Free to spend/)).toBeNull()
  })

  it('adjusts the balance from its own action without opening the editor', () => {
    const { onAdjust, onEdit } = renderRow(wallet())
    fireEvent.click(screen.getByRole('button', { name: 'Adjust balance' }))
    expect(onAdjust).toHaveBeenCalledWith(wallet().id)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('sets money aside from its menu', async () => {
    const { onSetAside, onEdit } = renderRow(wallet())
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'More for Main Checking' }),
      { key: 'Enter' },
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Set aside…' }))
    expect(onSetAside).toHaveBeenCalledWith('w1')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('lets only the name give way when the row runs out of width', () => {
    renderRow(holding({ isForeign: true, baseStr: '≈ SR 37,500.00' }))
    for (const text of ['SR 10,000.00', '≈ SR 37,500.00']) {
      const el = screen.getByText(text)
      expect(el.className).not.toContain('truncate')
      expect(el.className).toContain('whitespace-nowrap')
    }
    expect(screen.getByText('Main Checking').className).toContain('truncate')
  })
})
