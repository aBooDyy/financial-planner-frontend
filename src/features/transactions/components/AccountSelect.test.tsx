// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalBalanceNode } from '#/db/types'
import { AccountSelect } from './AccountSelect'

vi.setConfig({ testTimeout: 20000 })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

afterEach(cleanup)

const node = (over: Partial<LocalBalanceNode> & { id: string }) =>
  ({
    kind: 'wallet',
    parentId: null,
    name: over.id,
    color: '#1F9D6B',
    icon: null,
    currency: 'SAR',
    amount: 0,
    position: 0,
    deleted: 0,
    archivedAt: null,
    ...over,
  }) as LocalBalanceNode

const NODES = [
  node({ id: 'bank', kind: 'group', name: 'Bank', currency: null }),
  node({ id: 'main', name: 'Main', parentId: 'bank', amount: 150000 }),
  node({ id: 'savings', name: 'Savings', parentId: 'bank', position: 1 }),
  node({ id: 'cash', name: 'Cash', amount: 5000 }),
  node({ id: 'old', name: 'Old card', archivedAt: '2026-01-01T00:00:00Z' }),
]

vi.mock('#/features/planned/hooks/usePlannedData', () => ({
  usePlannedData: () => ({
    inputs: { base: 'SAR', rates: {} },
    nodes: NODES,
    loading: false,
    nodesLoading: false,
  }),
}))
vi.mock('#/features/transactions/hooks/useWalletDeltas', () => ({
  useWalletDeltas: () => ({}),
}))

const open = () =>
  fireEvent.click(screen.getByRole('combobox', { name: 'Account' }))

describe('AccountSelect', () => {
  const onChange = vi.fn()
  beforeEach(() => onChange.mockClear())

  it('lists wallets with balances under a group heading that is no pick', async () => {
    render(<AccountSelect label="Account" value="" onChange={onChange} />)
    open()
    const main = await screen.findByRole('option', { name: /Main/ })
    expect(main.textContent).toContain('1,500')
    expect(screen.queryByRole('option', { name: /Bank/ })).toBeNull()
    expect(screen.getByText('Bank')).toBeTruthy()
    fireEvent.click(main)
    expect(onChange).toHaveBeenCalledWith('main')
  })

  it('offers only the wallets it is given, plus an offered archived one', async () => {
    render(
      <AccountSelect
        label="Account"
        value="old"
        onChange={onChange}
        wallets={[{ id: 'cash' }, { id: 'old' }]}
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Account' }).textContent,
    ).toContain('Old card (archived)')
    open()
    await screen.findByRole('option', { name: /Cash/ })
    expect(screen.getByRole('option', { name: /Old card/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Main/ })).toBeNull()
    expect(screen.queryByText('Bank')).toBeNull()
  })

  it('reports the none row and a trailing answer by their own values', async () => {
    render(
      <AccountSelect
        label="Account"
        value="main"
        onChange={onChange}
        noneLabel="No account"
        trailing={[{ value: 'external', label: 'External…' }]}
      />,
    )
    open()
    fireEvent.click(await screen.findByRole('option', { name: 'No account' }))
    expect(onChange).toHaveBeenLastCalledWith('')
    open()
    fireEvent.click(await screen.findByRole('option', { name: 'External…' }))
    expect(onChange).toHaveBeenLastCalledWith('external')
  })

  it('names a wallet that no longer exists', () => {
    render(<AccountSelect label="Account" value="gone" onChange={onChange} />)
    expect(
      screen.getByRole('combobox', { name: 'Account' }).textContent,
    ).toContain('Deleted account')
  })
})
