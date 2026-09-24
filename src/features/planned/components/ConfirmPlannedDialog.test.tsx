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
import { goal, m, planned, wallet } from '#/features/planned/testing/fixtures'
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

const amountField = () => screen.getByLabelText<HTMLInputElement>('Amount')

describe('ConfirmPlannedDialog', () => {
  it('prefills the open remainder and confirms a set-aside as a reservation', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={onOpenChange} />)

    await waitFor(() => expect(amountField().value).toBe('1500'))
    expect(screen.getByRole('heading').textContent).toBe(
      `Planned for ${shortDate(daysAgo(23))} · 23 days agoUmrah trip`,
    )
    expect(
      await screen.findByText(
        /Umrah trip goes to SR 1,500\.00 of SR 13,000\.00/,
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm as paid' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const [reservation] = await db.goalAllocations.toArray()
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
    await waitFor(() => expect(amountField().value).toBe('1500'))
    fireEvent.change(amountField(), { target: { value: '1000' } })
    expect(
      await screen.findByText(/^Partial: SR 500\.00 stays open on this item\./),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Confirm partial SR 1,000.00' }),
    ).toBeTruthy()
  })

  it('disables confirming with no amount', async () => {
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('1500'))
    fireEvent.change(amountField(), { target: { value: '' } })
    expect(await screen.findByText('Enter an amount to confirm.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Confirm as paid' }),
    ).toHaveProperty('disabled', true)
  })

  it('confirms income as received, into the wallet', async () => {
    render(<ConfirmPlannedDialog plannedId="pay" onOpenChange={vi.fn()} />)
    await waitFor(() => expect(amountField().value).toBe('12000'))
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

  it('skips the item', async () => {
    const onOpenChange = vi.fn()
    render(<ConfirmPlannedDialog plannedId="sep" onOpenChange={onOpenChange} />)
    await waitFor(() => expect(amountField().value).toBe('1500'))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect((await db.plannedTransactions.get('sep'))?.status).toBe('skipped')
  })
})
