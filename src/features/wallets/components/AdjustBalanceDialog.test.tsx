// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import { useAdjustBalance } from '#/features/wallets/hooks/useAdjustBalance'
import { AdjustBalanceDialog } from './AdjustBalanceDialog'

const writes = vi.hoisted(() => ({
  createAdjustment: vi.fn(async () => 'adj-1'),
  deleteTransaction: vi.fn(async () => undefined),
}))
vi.mock('#/features/transactions/data/mutations', () => writes)

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

const MAIN: TransferWallet = {
  id: 'main',
  name: 'Main Checking',
  color: '#1F9D6B',
  icon: 'wallet',
  currency: 'SAR',
  balance: 100_000,
}

function Harness() {
  const a = useAdjustBalance([MAIN])
  return (
    <>
      <button type="button" onClick={() => a.openFor(MAIN.id)}>
        open
      </button>
      <AdjustBalanceDialog a={a} dateFormat="ymd" />
    </>
  )
}

const openDialog = () => {
  render(<Harness />)
  fireEvent.click(screen.getByText('open'))
}

describe('AdjustBalanceDialog', () => {
  it('waits for the actual balance before it can submit', () => {
    openDialog()
    const submit = screen.getByRole('button', {
      name: 'Enter the actual balance',
    })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })

  it('records the gap as a downward adjustment and offers undo', async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText('What does it really hold?'), {
      target: { value: '880' },
    })
    expect(screen.getByText('−SR 120.00')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Adjust balance' }))

    await waitFor(() =>
      expect(writes.createAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'adjustment_out',
          amount: 12_000,
          currency: 'SAR',
          walletId: 'main',
        }),
      ),
    )
    expect(
      await screen.findByText('Main Checking is now SR 880.00'),
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(writes.deleteTransaction).toHaveBeenCalledWith('adj-1'),
    )
  })

  it('refuses a balance that already matches', () => {
    openDialog()
    fireEvent.change(screen.getByLabelText('What does it really hold?'), {
      target: { value: '1000' },
    })
    const submit = screen.getByRole('button', { name: 'Already matches' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })
})
