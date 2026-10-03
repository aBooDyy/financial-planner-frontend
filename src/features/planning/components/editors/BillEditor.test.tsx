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
import { catId } from '#/features/categories/__fixtures__/categories'
import { bill, m } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { BillEditor } from './BillEditor'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  await seedPlanningDb()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const setDate = (label: string, iso: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: iso } })

describe('BillEditor', () => {
  it('adds a monthly bill covered from each paycheck', async () => {
    const onClose = vi.fn()
    render(<BillEditor id={null} onClose={onClose} onDelete={vi.fn()} />)

    expect(await screen.findByText('Give the bill a name')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('What is it?'), {
      target: { value: 'Rent' },
    })
    fireEvent.change(screen.getByLabelText('How much?'), {
      target: { value: '3000' },
    })
    expect(screen.getByText('Pick the next due date')).toBeTruthy()
    setDate('Next due date', '2026-11-01')
    await waitFor(() =>
      expect(screen.getByText('Covered from each paycheck.')).toBeTruthy(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add bill' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [saved] = await db.bills.toArray()
    expect(saved).toMatchObject({
      name: 'Rent',
      amount: m(3000),
      currency: 'SAR',
      frequency: 'monthly',
      nextDue: '2026-11-01',
      walletId: 'main',
      categoryId: catId('housing'),
      mustPay: true,
      autopay: false,
    })
    expect(usePlanningToast.getState().toast?.message).toBe(
      'Rent added to your plan',
    )
  })

  it('says what a bill due later sets aside each paycheck', async () => {
    render(<BillEditor id={null} onClose={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Annual' }))
    fireEvent.change(screen.getByLabelText('How much?'), {
      target: { value: '1200' },
    })
    // Paydays Oct 25 – Mar 25: six of them before Mar 31.
    setDate('Next due date', '2027-03-31')
    expect(
      await screen.findByText(
        'We’ll set aside SR 200 a paycheck so it’s ready on Mar 31.',
      ),
    ).toBeTruthy()
  })

  it('pays a bill due before payday from what is free now', async () => {
    render(<BillEditor id={null} onClose={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Just once' }))
    fireEvent.change(screen.getByLabelText('How much?'), {
      target: { value: '90' },
    })
    setDate('When is it due?', '2026-10-10')
    expect(
      await screen.findByText(
        'Due before your next paycheck. It will come out of what is free now.',
      ),
    ).toBeTruthy()
  })

  it('edits a bill, keeping what was not touched', async () => {
    await db.bills.put(
      bill({ id: 'b1', name: 'Gym', amount: m(200), walletId: 'main' }),
    )
    const onClose = vi.fn()
    render(<BillEditor id="b1" onClose={onClose} onDelete={vi.fn()} />)
    expect(await screen.findByText('Edit Gym')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Nice to have' }))
    fireEvent.change(screen.getByLabelText('How much?'), {
      target: { value: '250' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.bills.get('b1')).toMatchObject({
      name: 'Gym',
      amount: m(250),
      mustPay: false,
      categoryId: catId('housing'),
    })
  })

  it('ends a bill after a number of times on that occurrence’s date', async () => {
    await db.bills.put(
      bill({ id: 'b1', name: 'Gym', nextDue: '2026-10-01', walletId: 'main' }),
    )
    const onClose = vi.fn()
    render(<BillEditor id="b1" onClose={onClose} onDelete={vi.fn()} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'After 12 times' }),
    )
    expect(screen.getByText('Last one on Sep 1, 2027')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('How many times'), {
      target: { value: '3' },
    })
    expect(screen.getByText('Last one on Dec 1, 2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.bills.get('b1'))?.endsOn).toBe('2026-12-01')
  })

  it('asks before discarding edits', async () => {
    const onClose = vi.fn()
    render(<BillEditor id={null} onClose={onClose} onDelete={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('What is it?'), {
      target: { value: 'Rent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      await screen.findByRole('heading', { name: 'Discard your changes?' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalled()
  })
})
