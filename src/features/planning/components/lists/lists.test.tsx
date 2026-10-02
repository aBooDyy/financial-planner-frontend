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
import { bill, goal, m, setAside } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { BillsSection } from './BillsSection'
import { GoalsSection } from './GoalsSection'
import { IncomeSection } from './IncomeSection'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  Link: ({
    to,
    hash,
    children,
  }: {
    to: string
    hash?: string
    children: React.ReactNode
  }) => <a href={hash ? `${to}#${hash}` : to}>{children}</a>,
}))

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  usePlanningUi.setState({ sheet: null, detail: null })
  await seedPlanningDb()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const dataTransfer = { setData: () => undefined, effectAllowed: '' }

describe('Bills', () => {
  beforeEach(async () => {
    await db.bills.bulkPut([
      bill({
        id: 'rent',
        name: 'Rent',
        nextDue: '2026-11-01',
        walletId: 'main',
        position: 0,
      }),
      bill({
        id: 'ins',
        name: 'Car insurance',
        amount: m(2400),
        frequency: 'annual',
        nextDue: '2027-03-01',
        walletId: 'main',
        position: 1,
      }),
      bill({
        id: 'gym',
        name: 'Gym',
        amount: m(200),
        nextDue: '2026-10-20',
        mustPay: false,
        position: 2,
      }),
      bill({
        id: 'old',
        name: 'Old lease',
        closedAt: '2026-09-01T00:00:00Z',
        position: 3,
      }),
    ])
    await db.setAsides.put(
      setAside({
        goalId: null,
        billId: 'ins',
        occurrence: '2027-03-01',
        walletId: 'main',
        amount: m(800),
      }),
    )
  })

  it('lists the tiers with each bill’s coverage', async () => {
    render(<BillsSection />)
    const must = await screen.findByRole('region', { name: 'Must pay' })
    expect(within(must).getByText('Rent')).toBeTruthy()
    expect(
      within(must).getByText('Monthly · next Nov 1 · Main bank'),
    ).toBeTruthy()
    expect(within(must).getByText('Saving up 800 / 2,400')).toBeTruthy()
    const nice = screen.getByRole('region', { name: 'Nice to have' })
    expect(within(nice).getByText('Gym')).toBeTruthy()
    expect(screen.queryByText('Old lease')).toBeNull()
  })

  it('reopens a finished bill from Done', async () => {
    render(<BillsSection />)
    fireEvent.click(await screen.findByRole('button', { name: /Done/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await waitFor(async () =>
      expect((await db.bills.get('old'))?.closedAt).toBeNull(),
    )
  })

  it('moves a bill to the other tier when dropped on one of its rows', async () => {
    render(<BillsSection />)
    const rent = (await screen.findByText('Rent')).closest('li')
    const gym = screen.getByText('Gym').closest('li')
    if (!rent || !gym) throw new Error('rows missing')
    fireEvent.dragStart(rent, { dataTransfer })
    fireEvent.dragOver(gym, { dataTransfer })
    fireEvent.drop(gym, { dataTransfer })
    await waitFor(async () =>
      expect(await db.bills.get('rent')).toMatchObject({
        mustPay: false,
        position: 0,
      }),
    )
    expect((await db.bills.get('gym'))?.position).toBe(1)
  })

  it('opens Pay now from a row’s menu', async () => {
    render(<BillsSection />)
    fireEvent.keyDown(
      await screen.findByRole('button', { name: 'More for Rent' }),
      { key: 'Enter' },
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pay now' }))
    expect(usePlanningUi.getState().sheet).toEqual({
      kind: 'payNow',
      billId: 'rent',
    })
  })

  it('moves bills from the row menu on a phone, where there is no drag', async () => {
    const desktopMedia = window.matchMedia
    window.matchMedia = (query: string) => ({
      ...desktopMedia(query),
      matches: false,
    })
    try {
      render(<BillsSection />)
      const open = async (name: string) =>
        fireEvent.keyDown(
          await screen.findByRole('button', { name: `More for ${name}` }),
          { key: 'Enter' },
        )
      await open('Rent')
      expect(screen.queryByRole('menuitem', { name: 'Move up' })).toBeNull()
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Move down' }),
      )
      await waitFor(async () =>
        expect((await db.bills.get('rent'))?.position).toBe(1),
      )
      expect((await db.bills.get('ins'))?.position).toBe(0)

      await open('Car insurance')
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Move to Nice to have' }),
      )
      await waitFor(async () =>
        expect(await db.bills.get('ins')).toMatchObject({
          mustPay: false,
          position: 0,
        }),
      )
      expect((await db.bills.get('gym'))?.position).toBe(1)
    } finally {
      window.matchMedia = desktopMedia
    }
  })

  it('keeps the move items out of the menu on desktop, where rows drag', async () => {
    render(<BillsSection />)
    fireEvent.keyDown(
      await screen.findByRole('button', { name: 'More for Gym' }),
      { key: 'Enter' },
    )
    await screen.findByRole('menuitem', { name: 'Pay now' })
    expect(screen.queryByRole('menuitem', { name: /^Move/ })).toBeNull()
  })

  it('says what goes here when there are no bills', async () => {
    await db.bills.clear()
    render(<BillsSection />)
    expect(await screen.findByText('No bills yet')).toBeTruthy()
  })
})

describe('Goals', () => {
  it('shows progress, pace and pause in the tiers', async () => {
    await db.goals.bulkPut([
      goal({
        id: 'umrah',
        name: 'Umrah',
        target: m(9000),
        dueDate: '2027-06-30',
        mustHave: true,
      }),
      goal({
        id: 'travel',
        name: 'Travel fund',
        amount: m(300),
        pausedAt: '2026-09-01T00:00:00Z',
      }),
    ])
    render(<GoalsSection />)
    const must = await screen.findByRole('region', { name: 'Must have' })
    expect(within(must).getByText('Umrah')).toBeTruthy()
    expect(
      within(must).getByText(
        'SR 0 of SR 9,000 · by Jun 2027 · SR 1,000 a paycheck',
      ),
    ).toBeTruthy()
    const nice = screen.getByRole('region', { name: 'Nice to have' })
    expect(within(nice).getByText('Paused')).toBeTruthy()
    expect(within(nice).getByText('—')).toBeTruthy()
  })

  it('moves a goal to Must have from the row menu on a phone', async () => {
    await db.goals.bulkPut([
      goal({ id: 'umrah', name: 'Umrah', mustHave: true, position: 0 }),
      goal({ id: 'car', name: 'New car', mustHave: false, position: 1 }),
    ])
    const desktopMedia = window.matchMedia
    window.matchMedia = (query: string) => ({
      ...desktopMedia(query),
      matches: false,
    })
    try {
      render(<GoalsSection />)
      fireEvent.keyDown(
        await screen.findByRole('button', { name: 'More for New car' }),
        { key: 'Enter' },
      )
      expect(screen.queryByRole('menuitem', { name: 'Move up' })).toBeNull()
      expect(screen.queryByRole('menuitem', { name: 'Move down' })).toBeNull()
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Move to Must have' }),
      )
      await waitFor(async () =>
        expect(await db.goals.get('car')).toMatchObject({
          mustHave: true,
          position: 1,
        }),
      )
      expect((await db.goals.get('umrah'))?.position).toBe(0)
    } finally {
      window.matchMedia = desktopMedia
    }
  })

  it('offers the emergency fund when there are no goals', async () => {
    render(<GoalsSection />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Emergency fund/ }),
    )
    expect(usePlanningUi.getState().sheet).toMatchObject({
      kind: 'goal',
      preset: { name: 'Emergency fund', mustHave: true },
    })
  })
})

describe('Income', () => {
  it('tags the stream that sets the pay periods', async () => {
    render(<IncomeSection />)
    expect(await screen.findByText('Sets my pay periods')).toBeTruthy()
    expect(
      screen.getByText('SR 12,000 a month · pay periods run from the 25th'),
    ).toBeTruthy()
    expect(screen.getByText('Monthly · 25th · into Main bank')).toBeTruthy()
  })

  it('links to the Planning settings', async () => {
    render(<IncomeSection />)
    const link = await screen.findByRole('link', { name: 'Planning settings' })
    expect(link.getAttribute('href')).toBe('/settings/preferences#planning')
  })
})
