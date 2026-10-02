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
import { bill, goal, m } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { usePlanningToast } from '#/features/planning/stores/toast'
import { OverviewSection } from './OverviewSection'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  usePlanningUi.setState({ sheet: null, detail: null })
  navigate.mockReset()
  await seedPlanningDb()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Overview', () => {
  it('starts an empty plan from the chooser, with nothing else on screen', async () => {
    render(<OverviewSection />)
    expect(await screen.findByText('Start your plan')).toBeTruthy()
    expect(screen.queryByText('Each paycheck')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Plan something' }))
    expect(usePlanningUi.getState().sheet).toEqual({ kind: 'chooser' })
  })

  it('asks for income when there is none', async () => {
    await db.incomeStreams.clear()
    await db.bills.put(bill({ id: 'rent', nextDue: '2026-11-01' }))
    render(<OverviewSection />)
    expect(
      await screen.findByText('Add your income to see if you’re covered'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add income' }))
    expect(usePlanningUi.getState().sheet).toEqual({ kind: 'income', id: null })
  })

  it('says the plan is covered and splits the next paycheck', async () => {
    await db.bills.put(
      bill({
        id: 'rent',
        amount: m(3000),
        nextDue: '2026-11-01',
        walletId: 'main',
      }),
    )
    render(<OverviewSection />)
    expect(await screen.findByText('You’re covered')).toBeTruthy()
    expect(
      screen.getByText(
        'Every bill and goal in your plan fits in your pay. SR 9,000 is left for spending a paycheck.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('SR 12,000 · paid on the 25th')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bills: SR 3,000' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Left for spending: SR 9,000' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /See what’s coming/ }))
    expect(navigate).toHaveBeenCalledWith({
      to: '/planning/$section',
      params: { section: 'upcoming' },
    })
  })

  it('marks a plan that outruns pay and offers to push the goal out', async () => {
    await db.goals.put(
      goal({
        id: 'car',
        name: 'New car',
        target: m(150000),
        dueDate: '2027-03-31',
        mustHave: true,
      }),
    )
    render(<OverviewSection />)
    expect(
      await screen.findByText(/^Short by SR [\d,]+ a paycheck$/),
    ).toBeTruthy()
    expect(screen.getByText(/Your pay · SR 12,000/)).toBeTruthy()
    expect(screen.getByText('Needs a decision')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Push out' }))
    await waitFor(async () =>
      expect((await db.goals.get('car'))?.dueDate).toBe('2027-09-30'),
    )
    expect(usePlanningToast.getState().toast?.message).toBe(
      'New car moved to Sep 2027',
    )
  })
})
