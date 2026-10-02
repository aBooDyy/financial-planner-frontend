// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { db } from '#/db/db'
import { isoOf } from '#/features/planned/data/dates'
import { shortDate } from '#/features/planned/data/views'
import {
  goal,
  m,
  planned,
  tx,
  wallet,
} from '#/features/planned/testing/fixtures'
import { defaultCategoryRows } from '#/features/categories/__fixtures__/categories'
import { ConfirmPlannedDialog } from './ConfirmPlannedDialog'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

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

afterEach(cleanup)

const TODAY = isoOf(new Date())
const daysAgo = (n: number) => {
  const d = new Date()
  return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.put(
    wallet({ id: 'w1', name: 'Main Checking', amount: m(20000) }),
  )
  await db.goals.put(
    goal({ id: 'umrah', name: 'Umrah trip', target: m(13000) }),
  )
  await db.plannedTransactions.bulkPut([
    planned({
      id: 'sep',
      goalId: 'umrah',
      name: 'Umrah trip',
      occurrence: daysAgo(23),
      walletId: 'w1',
      amount: m(1500),
    }),
    planned({
      id: 'pay',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 's1',
      name: 'Salary',
      occurrence: TODAY,
      walletId: 'w1',
      amount: m(12000),
    }),
  ])
})

const amountField = () => screen.getByLabelText<HTMLInputElement>(/^How much/)

describe('ConfirmPlannedDialog', () => {
  it('prefills the open remainder and confirms a set-aside as a reservation', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={onOpenChange} />)

    await waitFor(() => expect(amountField().value).toBe('1,500.00'))
    expect(screen.getByRole('heading').textContent).toBe(
      `Due ${shortDate(daysAgo(23))} · 23 days agoUmrah trip`,
    )
    expect(
      await screen.findByText(
        /Umrah trip goes to SR 1,500\.00 of SR 13,000\.00/,
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm as paid' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const [reservation] = await db.setAsides.toArray()
    expect(reservation).toMatchObject({
      goalId: 'umrah',
      walletId: 'w1',
      amount: m(1500),
      plannedId: 'sep',
      date: TODAY,
    })
  })

  it('turns a smaller amount into a partial and says what stays open', async () => {
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('1,500.00'))
    fireEvent.change(amountField(), { target: { value: '1000' } })
    expect(await screen.findByText('Partial:')).toBeTruthy()
    expect(
      screen.getByText(/^SR 500\.00 stays open on this item\./),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Confirm partial SR 1,000.00' }),
    ).toBeTruthy()
  })

  it('disables confirming with no amount', async () => {
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('1,500.00'))
    fireEvent.change(amountField(), { target: { value: '' } })
    expect(await screen.findByText('Enter an amount to confirm.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Confirm as paid' }),
    ).toHaveProperty('disabled', true)
  })

  it('confirms income as received, into the wallet', async () => {
    render(<ConfirmPlannedDialog plannedId="pay" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('12,000.00'))
    expect(
      await screen.findByText('Main Checking goes to SR 32,000.00.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm received' }))
    await waitFor(async () => expect(await db.transactions.count()).toBe(1))
    const [t] = await db.transactions.toArray()
    expect(t).toMatchObject({
      type: 'income',
      plannedId: 'pay',
      amount: m(12000),
    })
  })

  it('counts every entry on the wallet in its balance, linked or not', async () => {
    await db.transactions.bulkPut([
      tx({ amount: m(35) }),
      tx({ type: 'income', amount: m(500) }),
      tx({ type: 'transfer_out', transferId: 'x1', amount: m(70) }),
      tx({ type: 'transfer_in', transferId: 'x2', amount: m(40) }),
      tx({ type: 'adjustment_in', amount: m(10) }),
      tx({ type: 'adjustment_out', amount: m(5) }),
      tx({ amount: m(999), deleted: 1 }),
      tx({ walletId: 'w2', amount: m(1000) }),
    ])
    render(<ConfirmPlannedDialog plannedId="pay" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('12,000.00'))
    // 20,000 − 35 + 500 − 70 + 40 + 10 − 5 + 12,000
    expect(
      await screen.findByText('Main Checking goes to SR 32,440.00.'),
    ).toBeTruthy()
  })

  it('skips the item once asked', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={onOpenChange} />)
    await waitFor(() => expect(amountField().value).toBe('1,500.00'))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Skip it' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect((await db.plannedTransactions.get('sep'))?.status).toBe('skipped')
  })
})
