// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { buildGoalPlanView } from '#/features/planned'
import { indexSettlements } from '#/features/planned/data/settle'
import {
  RATES,
  goal,
  m,
  planned,
  wallet,
} from '#/features/planned/testing/fixtures'
import { AddContributionDialog } from './AddContributionDialog'

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 24, 12))
  Element.prototype.scrollIntoView = () => undefined
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})
afterAll(() => {
  vi.useRealTimers()
})
afterEach(cleanup)

const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
const UMRAH = goal({
  id: 'umrah',
  name: 'Umrah trip',
  target: m(13000),
  saved: m(4000),
  plannedAt: '2026-06-12',
  planAmount: m(1500),
  planCount: 8,
})
const rows = ['2026-09-01', '2026-10-01'].map((occurrence) =>
  planned({ id: `umrah:${occurrence}`, goalId: 'umrah', occurrence }),
)
const plan = buildGoalPlanView({
  goal: UMRAH,
  planned: rows,
  desired: [],
  txns: [],
  allocations: [],
  progress: undefined,
  nodes: [MAIN],
  index: indexSettlements([], []),
  rates: RATES,
  today: '2026-09-24',
})

const renderDialog = () => {
  const add = vi.fn().mockResolvedValue({
    kind: 'settled',
    settlementId: 's',
    plannedId: null,
  })
  const onOpenChange = vi.fn()
  render(
    <AddContributionDialog
      open
      onOpenChange={onOpenChange}
      goal={UMRAH}
      plan={plan}
      subtitle="SR 9,000 left · next planned Oct 1"
      nodes={[MAIN]}
      add={add}
    />,
  )
  return { add, onOpenChange }
}

const typeAmount = (value: string) =>
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value } })

describe('AddContributionDialog', () => {
  it('titles itself after the goal and waits for an amount', () => {
    renderDialog()
    expect(screen.getByText('Add to Umrah trip')).toBeDefined()
    expect(screen.getByText('SR 9,000 left · next planned Oct 1')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('paid now settles the due set-aside and says so', async () => {
    const { add, onOpenChange } = renderDialog()
    typeAmount('1000')
    expect(
      screen.getByText(
        'Settles the planned Sep 1 set-aside (SR 1,500) instead of adding a second entry. Saved goes to SR 5,000.',
      ),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Add SR 1,000' }))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(add).toHaveBeenCalledWith({
      mode: 'now',
      amount: m(1000),
      walletId: 'w1',
      externalLabel: null,
      date: '2026-09-24',
    })
  })

  it('plan for later defaults to the next planned date', async () => {
    const { add } = renderDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Plan for later' }))
    typeAmount('1000')
    expect(
      screen.getByText(
        'Adds a planned item on Oct 1. It shows in Spending as planned and only counts once you confirm it.',
      ),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Plan SR 1,000' }))
    await vi.waitFor(() =>
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'later', date: '2026-10-01' }),
      ),
    )
  })
})
