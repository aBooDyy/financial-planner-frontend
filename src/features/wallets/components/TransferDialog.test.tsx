// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { LocalSetAside } from '#/db/types'
import { m, setAside } from '#/features/planned/testing/fixtures'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { useTransferDialog } from '#/features/wallets/hooks/useTransferDialog'
import { TransferDialog } from './TransferDialog'

const writes = vi.hoisted(() => ({
  createTransfer: vi.fn(async () => 't-1'),
  deleteTransfer: vi.fn(async () => undefined),
  moveSetAsides: vi.fn(async () => undefined),
}))
vi.mock('#/features/transactions/data/transfers', () => ({
  createTransfer: writes.createTransfer,
  deleteTransfer: writes.deleteTransfer,
}))
vi.mock('#/features/setAsides/data/batches', () => ({
  moveSetAsides: writes.moveSetAsides,
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const wallet = (id: string, name: string, balance: number): TransferWallet => ({
  id,
  name,
  color: '#1F9D6B',
  icon: 'wallet',
  currency: 'SAR',
  balance,
})
const MAIN = wallet('main', 'Main bank', m(1000))
const SAVINGS = wallet('savings', 'Savings', 0)

const ROWS: LocalSetAside[] = [
  setAside({
    id: 'car-1',
    goalId: null,
    billId: 'car',
    walletId: 'main',
    amount: m(300),
  }),
  setAside({
    id: 'umrah-1',
    goalId: 'umrah',
    walletId: 'main',
    amount: m(100),
  }),
]
const LINES = {
  main: [
    {
      ownerId: 'car',
      owner: 'bill' as const,
      ownerName: 'Car insurance',
      color: '#000',
      amount: m(300),
    },
    {
      ownerId: 'umrah',
      owner: 'goal' as const,
      ownerName: 'Umrah',
      color: '#000',
      amount: m(100),
    },
  ],
}

function Harness() {
  const t = useTransferDialog(
    [MAIN, SAVINGS],
    { SAR: 1 },
    {
      lines: LINES,
      rows: ROWS,
    },
  )
  return (
    <>
      <button type="button" onClick={t.openDialog}>
        open
      </button>
      <TransferDialog t={t} rates={{ SAR: 1 }} dateFormat="ymd" />
    </>
  )
}

const transfer = (amount: string) => {
  render(<Harness />)
  fireEvent.click(screen.getByText('open'))
  fireEvent.change(screen.getByLabelText('How much are you moving?'), {
    target: { value: amount },
  })
  fireEvent.click(
    screen.getByRole('button', { name: `Transfer SR ${amount}.00` }),
  )
}

describe('Transfer money and set-asides', () => {
  it('moves money within Free to spend without asking', async () => {
    transfer('500')
    await waitFor(() => expect(writes.createTransfer).toHaveBeenCalled())
    expect(screen.queryByText(/of this is set aside/)).toBeNull()
    expect(writes.moveSetAsides).not.toHaveBeenCalled()
  })

  it('asks before moving set-aside money, and moves the set-asides with it', async () => {
    transfer('800')
    expect(
      screen.getByText(
        'SR 200.00 of this is set aside (Car insurance SR 200.00). Move those set-asides with it?',
      ),
    ).toBeTruthy()
    expect(writes.createTransfer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Move them' }))
    await waitFor(() => expect(writes.moveSetAsides).toHaveBeenCalled())
    expect(writes.moveSetAsides).toHaveBeenCalledWith(
      [{ id: 'car-1', amount: m(200), to: { walletId: 'savings' } }],
      expect.objectContaining({ transferId: 't-1' }),
    )
    expect(
      await screen.findByText(/SR 200.00 set aside moved with it/),
    ).toBeTruthy()
  })

  it('leaves them behind when asked to', async () => {
    transfer('900')
    fireEvent.click(screen.getByRole('button', { name: 'Leave them' }))
    await waitFor(() => expect(writes.createTransfer).toHaveBeenCalled())
    expect(writes.moveSetAsides).not.toHaveBeenCalled()
  })
})
