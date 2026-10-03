// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { plannedIdFor } from '#/features/planned/data/ids'
import {
  bill,
  goal,
  m,
  planned,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { useRecalcUndoStore } from '#/features/planned/stores/recalcUndo'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { BillDetail } from './BillDetail'
import { GoalDetail } from './GoalDetail'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  usePlanningUi.setState({ sheet: null, detail: null })
  useRecalcUndoStore.setState({ byOwner: {} })
  await seedPlanningDb()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BillDetail', () => {
  beforeEach(async () => {
    await db.bills.put(
      bill({
        id: 'ins',
        name: 'Car insurance',
        amount: m(2400),
        frequency: 'semi',
        nextDue: '2027-03-01',
        walletId: 'main',
      }),
    )
    await db.setAsides.put(
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'main',
        amount: m(800),
        date: '2026-09-25',
      }),
    )
  })

  it('shows what is set aside, where, the plan and what is next', async () => {
    render(<BillDetail billId="ins" onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', {
      name: 'Car insurance',
    })
    expect(within(panel).getByText('SR 800 of SR 2,400')).toBeTruthy()
    expect(within(panel).getByText('Set aside so far')).toBeTruthy()
    const held = within(panel).getByText('Held in').parentElement
    expect(held && within(held).getByText('Main bank')).toBeTruthy()
    expect(within(panel).getByText(/in Main bank until Mar 1\.$/)).toBeTruthy()
    expect(within(panel).getByText('Mar 1, 2027')).toBeTruthy()
    expect(within(panel).getByText('Sep 1, 2027')).toBeTruthy()
    expect(within(panel).getByText('+SR 800')).toBeTruthy()
  })

  it('names the wallet it saves up in, and the year of a due date a year off', async () => {
    await db.balanceNodes.put(
      wallet({ id: 'savings', name: 'Savings', amount: m(5000) }),
    )
    await db.bills.put(
      bill({
        id: 'reg',
        name: 'Registration',
        amount: m(1200),
        frequency: 'annual',
        nextDue: '2027-11-15',
        walletId: 'main',
        saveWalletId: 'savings',
      }),
    )
    render(<BillDetail billId="reg" onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', {
      name: 'Registration',
    })
    expect(
      within(panel).getByText(/in Savings for Nov 15, 2027.$/),
    ).toBeTruthy()
  })

  it('opens Pay now from its main button', async () => {
    render(<BillDetail billId="ins" onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'payNow',
      billId: 'ins',
    })
  })
})

describe('BillDetail — a plan whose rows drifted', () => {
  const rentId = (occurrence: string) =>
    plannedIdFor('u1', 'bill', 'rent', 'set_aside', occurrence)
  const rentSetAsides = async () =>
    (await db.plannedTransactions.where('billId').equals('rent').toArray())
      .filter((p) => p.role === 'set_aside' && p.deleted === 0)
      .sort((a, b) => a.occurrence.localeCompare(b.occurrence))
      .map((p) => [p.occurrence, p.amount / 100])

  beforeEach(async () => {
    // Its headline still reads SR 3,500, as today's plan does.
    await db.bills.put(
      bill({
        id: 'rent',
        name: 'Rent',
        amount: m(3500),
        nextDue: '2026-12-01',
        walletId: 'main',
        plannedAt: '2026-09-01',
        planAmount: m(3500),
        planCount: 2,
        planStart: '2026-10-25',
      }),
    )
    // An older engine split December's rent over two paydays; today's covers it from Nov 25.
    await db.plannedTransactions.bulkPut(
      ['2026-10-25', '2026-11-25'].map((occurrence) =>
        planned({
          id: rentId(occurrence),
          origin: 'bill',
          goalId: null,
          billId: 'rent',
          name: 'Rent',
          occurrence,
          amount: m(1750),
        }),
      ),
    )
  })

  it('offers to recalculate the rows, rewrites them, then offers to undo', async () => {
    render(<BillDetail billId="rent" onClose={vi.fn()} />)
    expect(
      await screen.findByText(
        'Your plan sets aside SR 1,750 × 2 from Oct 25; today it works out to SR 3,500 on Nov 25.',
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))
    await waitFor(() =>
      expect(usePlanningToast.getState().toast?.message).toBe('Plan updated'),
    )
    expect(await rentSetAsides()).toEqual([
      ['2026-11-25', 3500],
      ['2026-12-25', 3500],
    ])
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull(),
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () =>
      expect(await rentSetAsides()).toEqual([
        ['2026-10-25', 1750],
        ['2026-11-25', 1750],
      ]),
    )
  })
})

describe('GoalDetail', () => {
  it('offers to recalculate a plan that drifted, then to undo it', async () => {
    await db.goals.put(
      goal({
        id: 'umrah',
        name: 'Umrah',
        target: m(9000),
        dueDate: '2027-06-30',
        saveWalletId: 'main',
        plannedAt: '2026-09-01',
        planAmount: m(500),
        planCount: 9,
        planStart: '2026-10-25',
      }),
    )
    render(<GoalDetail goalId="umrah" onClose={vi.fn()} />)
    expect(
      await screen.findByText(
        'Your plan says SR 500 a paycheck; today it works out to SR 1,000.',
      ),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }))
    await waitFor(() =>
      expect(usePlanningToast.getState().toast?.message).toBe('Plan updated'),
    )
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy()
    expect((await db.goals.get('umrah'))?.planAmount).toBe(m(1000))
  })

  it('says a paused goal sets nothing aside', async () => {
    await db.goals.put(
      goal({
        id: 'travel',
        name: 'Travel fund',
        amount: m(300),
        pausedAt: '2026-09-01T00:00:00Z',
      }),
    )
    render(<GoalDetail goalId="travel" onClose={vi.fn()} />)
    expect(
      await screen.findByText(
        'Paused. Nothing is set aside until you resume it.',
      ),
    ).toBeTruthy()
  })
})
