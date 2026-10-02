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
import {
  bill,
  goal,
  income,
  m,
  wallet,
} from '#/features/planned/testing/fixtures'
import { plannedScenario } from '#/features/planning/testing/state'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { PaydayReviewSheet } from './PaydayReviewSheet'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

const rent = bill({
  id: 'rent',
  name: 'Rent',
  nextDue: '2026-11-01',
  walletId: 'main',
})
const umrah = goal({
  id: 'umrah',
  name: 'Umrah',
  target: m(9000),
  dueDate: '2027-06-30',
  saveWalletId: 'savings',
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  await seedPlanningDb()
  await db.balanceNodes.put(
    wallet({ id: 'savings', name: 'Savings', amount: m(100), position: 1 }),
  )
  await db.bills.put(rent)
  await db.goals.put(umrah)
  const { inputs } = plannedScenario({
    bills: [rent],
    goals: [umrah],
    income: [
      income({ id: 'salary', amount: m(12000), day: 25, walletId: 'main' }),
    ],
    today: '2026-10-02',
  })
  await db.plannedTransactions.bulkPut(inputs.planned)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('PaydayReviewSheet', () => {
  it('lists the paycheck’s set-asides by group, with the transfer they need', async () => {
    render(<PaydayReviewSheet payday="2026-10-25" onClose={vi.fn()} />)
    expect(
      await screen.findByText('Set aside from your Oct 25 paycheck'),
    ).toBeTruthy()
    expect(screen.getByText('Bills due before next payday')).toBeTruthy()
    expect(screen.getByText('Rent')).toBeTruthy()
    expect(screen.getByText('Due Nov 1')).toBeTruthy()
    expect(screen.getByText('Goals')).toBeTruthy()
    expect(screen.getByText('By Jun 2027')).toBeTruthy()
    expect(screen.getByText('I’ve moved SR 1,000 to Savings')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Set aside SR 4,000' }),
    ).toBeTruthy()
  })

  it('sets aside the ticked lines and records the transfer', async () => {
    const onClose = vi.fn()
    render(<PaydayReviewSheet payday="2026-10-25" onClose={onClose} />)
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Set aside for Rent' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Set aside SR 1,000' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const made = await db.setAsides.toArray()
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({
      goalId: 'umrah',
      walletId: 'savings',
      amount: m(1000),
    })
    const legs = await db.transactions.toArray()
    expect(legs.map((t) => t.type).sort()).toEqual([
      'transfer_in',
      'transfer_out',
    ])
    expect(usePlanningToast.getState().toast?.message).toBe(
      'SR 1,000 set aside across 1 item',
    )
  })

  it('edits an amount before setting it aside', async () => {
    const onClose = vi.fn()
    render(<PaydayReviewSheet payday="2026-10-25" onClose={onClose} />)
    fireEvent.change(await screen.findByLabelText('Amount for Umrah'), {
      target: { value: '600' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Set aside for Rent' }),
    )
    expect(screen.getByText('I’ve moved SR 600 to Savings')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set aside SR 600' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.setAsides.toArray())[0]?.amount).toBe(m(600))
  })
})
