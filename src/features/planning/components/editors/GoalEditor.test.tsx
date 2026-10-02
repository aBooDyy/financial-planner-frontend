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
import { goal, m } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { GoalEditor } from './GoalEditor'

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

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('GoalEditor', () => {
  it('works out what a dated target needs each paycheck', async () => {
    const onClose = vi.fn()
    render(<GoalEditor id={null} onClose={onClose} onDelete={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('What are you saving for?'), {
      target: { value: 'Umrah trip' },
    })
    expect(screen.getByText('Pick a date or a monthly amount')).toBeTruthy()
    type('By when?', '2027-06-30')
    expect(
      await screen.findByText(
        'Add a target amount to work out what to set aside.',
      ),
    ).toBeTruthy()
    type('How much do you need?', '9000')
    // Paydays Oct 25 – Jun 25: nine of them.
    expect(
      await screen.findByText(
        'Set aside SR 1,000 a paycheck to have SR 9,000 by Jun 2027.',
      ),
    ).toBeTruthy()
    expect(screen.queryByLabelText('How much each month?')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [saved] = await db.goals.toArray()
    expect(saved).toMatchObject({
      name: 'Umrah trip',
      target: m(9000),
      dueDate: '2027-06-30',
      amount: null,
      saveWalletId: 'main',
      mustHave: false,
    })
  })

  it('saves a monthly amount with no end date', async () => {
    const onClose = vi.fn()
    render(<GoalEditor id={null} onClose={onClose} onDelete={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('What are you saving for?'), {
      target: { value: 'Travel fund' },
    })
    type('How much each month?', '300')
    expect(
      await screen.findByText('Set aside SR 300 a month, with no end date.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Must have' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const [saved] = await db.goals.toArray()
    expect(saved).toMatchObject({
      target: null,
      amount: m(300),
      dueDate: null,
      mustHave: true,
    })
  })

  it('starts from the emergency fund suggestion', async () => {
    render(
      <GoalEditor
        id={null}
        preset={{
          name: 'Emergency fund',
          target: m(9000),
          amount: null,
          mustHave: true,
        }}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(await screen.findByDisplayValue('Emergency fund')).toBeTruthy()
    expect(screen.getByDisplayValue('9,000.00')).toBeTruthy()
    expect(
      screen
        .getByRole('radio', { name: 'Must have' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('says when a target with a monthly amount is reached', async () => {
    await db.goals.put(
      goal({
        id: 'car',
        name: 'New car',
        target: m(30000),
        amount: m(1000),
        saveWalletId: 'main',
      }),
    )
    render(<GoalEditor id="car" onClose={vi.fn()} onDelete={vi.fn()} />)
    expect(await screen.findByText('Edit New car')).toBeTruthy()
    expect(
      screen.getByText('Set aside SR 1,000 a month. Done around Apr 2029.'),
    ).toBeTruthy()
  })
})
