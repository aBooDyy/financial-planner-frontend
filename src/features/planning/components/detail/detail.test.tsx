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
  tx,
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

describe('HeldIn', () => {
  const openPlan = async () => {
    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
  }

  it('moves from a bill’s wallet, not from what is held outside', async () => {
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
    await db.setAsides.bulkPut([
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'main',
        amount: m(800),
      }),
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        source: 'outside',
        walletId: null,
        externalLabel: 'Cash with mom',
        amount: m(100),
      }),
    ])
    render(<BillDetail billId="ins" onClose={vi.fn()} />)
    await openPlan()
    expect(screen.getByText('Cash with mom')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Move from/ }).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Move from Main bank' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'move',
      from: {
        kind: 'held',
        owner: { kind: 'bill', id: 'ins' },
        walletId: 'main',
      },
    })
  })

  it('moves from a goal’s wallet', async () => {
    await db.goals.put(goal({ id: 'car', name: 'Car', target: m(5000) }))
    await db.setAsides.put(
      setAside({ goalId: 'car', walletId: 'main', amount: m(800) }),
    )
    render(<GoalDetail goalId="car" onClose={vi.fn()} />)
    await openPlan()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Move from Main bank' }),
    )
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'move',
      from: {
        kind: 'held',
        owner: { kind: 'goal', id: 'car' },
        walletId: 'main',
      },
    })
  })

  it('offers no Move on a closed goal', async () => {
    await db.goals.put(
      goal({
        id: 'car',
        name: 'Car',
        target: m(5000),
        closedAt: '2026-09-30',
      }),
    )
    await db.setAsides.put(
      setAside({ goalId: 'car', walletId: 'main', amount: m(800) }),
    )
    render(<GoalDetail goalId="car" onClose={vi.fn()} />)
    await openPlan()
    expect(await screen.findByText('Main bank')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Move from/ })).toBeNull()
  })
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
    expect(within(panel).getByText('Mar 1, 2027')).toBeTruthy()
    expect(within(panel).getByText('Sep 1, 2027')).toBeTruthy()

    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
    const held = within(panel).getByText('Held in').parentElement
    expect(held && within(held).getByText('Main bank')).toBeTruthy()
    expect(within(panel).getByText(/in Main bank until Mar 1\.$/)).toBeTruthy()

    fireEvent.click(await screen.findByRole('radio', { name: 'History' }))
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
    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
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

describe('BillDetail — its dates', () => {
  beforeEach(async () => {
    await db.bills.put(
      bill({
        id: 'elec',
        name: 'Electricity',
        amount: m(400),
        amountVaries: true,
        nextDue: '2026-08-15',
        walletId: 'main',
        createdAt: '2026-01-01T00:00:00Z',
      }),
    )
  })

  it('lists what was missed and pays any of those dates', async () => {
    render(<BillDetail billId="elec" onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', {
      name: 'Electricity',
    })
    expect(await within(panel).findByText('Overdue · 2')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /^Sep 15/ }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Pay' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'payNow',
      billId: 'elec',
      occurrence: '2026-09-15',
    })
  })

  it('reads the amount as an estimate', async () => {
    render(<BillDetail billId="elec" onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', {
      name: 'Electricity',
    })
    expect(within(panel).getAllByText('≈SR 400').length).toBeGreaterThan(0)
    expect(within(panel).getByText(/Amount varies/)).toBeTruthy()
  })

  it('opens a set-aside from the date it is for, and skips a date', async () => {
    await db.setAsides.put(
      setAside({
        id: 'held',
        goalId: null,
        billId: 'elec',
        occurrence: '2026-08-15',
        walletId: 'main',
        amount: m(120),
        date: '2026-08-01',
      }),
    )
    render(<BillDetail billId="elec" onClose={vi.fn()} />)
    const panel = await screen.findByRole('complementary', {
      name: 'Electricity',
    })
    fireEvent.click(
      await within(panel).findByRole('button', { name: /^Aug 15/ }),
    )
    fireEvent.click(
      within(panel).getByRole('button', { name: /^Set aside Aug 1/ }),
    )
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'setAside',
      id: 'held',
    })
    fireEvent.click(within(panel).getByRole('button', { name: 'Skip' }))
    await waitFor(async () =>
      expect((await db.bills.get('elec'))?.nextDue).toBe('2026-09-15'),
    )
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
    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
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
  it('opens a set-aside and a spend from its history', async () => {
    await db.goals.put(goal({ id: 'car', name: 'Car', amount: m(300) }))
    await db.setAsides.put(
      setAside({ id: 'sa', goalId: 'car', amount: m(150), date: '2026-09-01' }),
    )
    await db.transactions.put(
      tx({ id: 'spent', goalId: 'car', amount: m(40), date: '2026-09-02' }),
    )
    render(<GoalDetail goalId="car" onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /\+SR 150/ }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'setAside',
      id: 'sa',
    })
    fireEvent.click(screen.getByRole('button', { name: /−SR 40/ }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'payment',
      transactionId: 'spent',
    })
  })

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
    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
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
    fireEvent.click(await screen.findByRole('radio', { name: 'Plan' }))
    expect(
      await screen.findByText(
        'Paused. Nothing is set aside until you resume it.',
      ),
    ).toBeTruthy()
  })
})
