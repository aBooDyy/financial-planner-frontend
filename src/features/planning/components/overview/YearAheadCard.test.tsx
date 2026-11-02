// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import { db } from '#/db/db'
import { bill } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { OverviewSection } from './OverviewSection'

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(stubBrowser)

const setWidth = (desktop: boolean) => {
  window.matchMedia = (query: string) =>
    ({
      matches: desktop,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
}

const renderOverview = () =>
  render(<OverviewSection />, { wrapper: TooltipProvider })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2))
  usePlanningUi.setState({ sheet: null, detail: null })
  await seedPlanningDb()
  await db.bills.put(
    bill({ id: 'rent', name: 'Rent', nextDue: '2026-11-01', walletId: 'main' }),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Overview year ahead', () => {
  it('shows scrolling lanes on a phone and breaks a month down on tap', async () => {
    setWidth(false)
    const { container } = renderOverview()
    expect(await screen.findByText('You’re covered')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Year ahead' })).toBeTruthy()
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy()
    expect(screen.getByText('Coming in')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Nov' }))
    expect(await screen.findByText('Nov 2026')).toBeTruthy()
  })

  it('stays out of the desktop Overview', async () => {
    setWidth(true)
    renderOverview()
    expect(await screen.findByText('You’re covered')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Year ahead' })).toBeNull()
  })
})
