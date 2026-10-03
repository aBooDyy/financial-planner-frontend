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
import {
  bill,
  goal,
  income,
  m,
  planned,
} from '#/features/planned/testing/fixtures'
import { plannedScenario } from '#/features/planning/testing/state'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { UpcomingSection } from './UpcomingSection'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

const TODAY = '2026-10-02'
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
  saveWalletId: 'main',
})
const salary = income({
  id: 'salary',
  amount: m(12000),
  day: 25,
  walletId: 'main',
})

/** The rows the planner would have written, plus one payment waiting to be confirmed. */
async function seedPlan() {
  await db.bills.put(rent)
  await db.goals.put(umrah)
  const { inputs } = plannedScenario({
    bills: [rent],
    goals: [umrah],
    income: [salary],
    today: TODAY,
  })
  await db.plannedTransactions.bulkPut([
    ...inputs.planned.map((p) => ({ ...p, walletId: p.walletId ?? 'main' })),
    planned({
      id: '0192f0c4-0000-7000-8000-000000000001',
      origin: 'manual',
      role: 'payment',
      goalId: null,
      name: 'Gym',
      amount: m(200),
      occurrence: '2026-10-01',
      walletId: 'main',
    }),
  ])
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  usePlanningUi.setState({ sheet: null, detail: null })
  usePlanningToast.setState({ toast: null })
  await seedPlanningDb()
  await seedPlan()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Upcoming by paycheck', () => {
  it('asks about what is due, then groups the rest by pay period', async () => {
    render(<UpcomingSection />)
    const band = await screen.findByRole('region', { name: 'Needs confirming' })
    expect(within(band).getByText('Gym')).toBeTruthy()
    expect(within(band).getByText('Was due Oct 1 · Main bank')).toBeTruthy()
    expect(screen.getByText('Until payday')).toBeTruthy()
    expect(screen.getByText('Now → Oct 24')).toBeTruthy()
    expect(screen.getByText('Next paycheck · Oct 25')).toBeTruthy()
    expect(screen.getByText('Oct 25 – Nov 24')).toBeTruthy()
    expect(screen.getAllByText('+SR 12,000 in').length).toBeGreaterThan(0)
  })

  it('pays a future bill now, for that occurrence', async () => {
    render(<UpcomingSection />)
    const rentRow = (await screen.findAllByText('Rent'))
      .map((el) => el.closest('li'))
      .find((li) => li && within(li).queryByRole('button', { name: 'Pay now' }))
    if (!rentRow) throw new Error('no Rent payment row')
    fireEvent.click(within(rentRow).getByRole('button', { name: 'Pay now' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'payNow',
      billId: 'rent',
      occurrence: '2026-11-01',
    })
  })

  it('offers Pay now on an auto-pay bill too', async () => {
    await db.bills.put({ ...rent, autopay: true })
    render(<UpcomingSection />)
    await screen.findAllByText('Auto-pay')
    const rentRow = screen
      .getAllByText('Rent')
      .map((el) => el.closest('li'))
      .find((li) => li && within(li).queryByText('Auto-pay'))
    if (!rentRow) throw new Error('no auto-pay Rent row')
    expect(within(rentRow).getByRole('button', { name: 'Pay now' })).toBeTruthy()
  })

  it('sets a future set-aside aside now', async () => {
    render(<UpcomingSection />)
    const rows = await screen.findAllByText('Umrah')
    const row = rows[0].closest('li')
    if (!row) throw new Error('no Umrah row')
    fireEvent.click(within(row).getByRole('button', { name: 'Set aside now' }))
    await waitFor(async () => expect(await db.setAsides.count()).toBe(1))
    expect((await db.setAsides.toArray())[0]).toMatchObject({
      goalId: 'umrah',
      walletId: 'main',
    })
    await waitFor(() =>
      expect(usePlanningToast.getState().toast?.message).toBe(
        'SR 1,000 set aside for Umrah',
      ),
    )
  })

  it('confirms a due payment and says so', async () => {
    render(<UpcomingSection />)
    const band = await screen.findByRole('region', { name: 'Needs confirming' })
    fireEvent.click(within(band).getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(usePlanningToast.getState().toast?.message).toBe(
        'Gym marked as paid',
      ),
    )
  })

  it('skips a due payment and says so', async () => {
    render(<UpcomingSection />)
    const band = await screen.findByRole('region', { name: 'Needs confirming' })
    fireEvent.click(within(band).getByRole('button', { name: 'Skip' }))
    await waitFor(() =>
      expect(usePlanningToast.getState().toast?.message).toBe('Gym skipped'),
    )
  })

  it('opens the payday review', async () => {
    render(<UpcomingSection />)
    fireEvent.click(await screen.findByRole('button', { name: /Review/ }))
    expect(usePlanningUi.getState().sheet).toMatchObject({ kind: 'review' })
  })

  it('switches to the year ahead lanes', async () => {
    render(<UpcomingSection />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Year ahead' }))
    expect(await screen.findByText('Total set aside')).toBeTruthy()
    expect(screen.getByText(/^Oct 2026 – /)).toBeTruthy()
    expect(screen.getByText('Monthly bills')).toBeTruthy()
    const goalBar = screen.getByText('SR 1,000 a paycheck')
    expect(goalBar).toBeTruthy()
    fireEvent.click(goalBar)
    expect(usePlanningUi.getState().detail).toEqual({
      kind: 'goal',
      id: 'umrah',
    })
  })
})
