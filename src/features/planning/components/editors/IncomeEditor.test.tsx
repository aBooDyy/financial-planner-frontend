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
import { SETTINGS_KEY } from '#/db/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { m } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { IncomeEditor } from './IncomeEditor'

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

describe('IncomeEditor', () => {
  it('adds a monthly income filed under Salary', async () => {
    const onClose = vi.fn()
    render(<IncomeEditor id={null} onClose={onClose} onDelete={vi.fn()} />)
    await screen.findByLabelText('What is it?')
    type('What is it?', 'Bonus')
    type('How much comes in?', '1500')
    expect(
      screen.getByText('Pick the day of the month it lands, 1 to 31'),
    ).toBeTruthy()
    type('Paid on', '10')
    expect(
      await screen.findByText('SR 1,500 monthly · next payday Oct 10.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add income' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const added = (await db.incomeStreams.toArray()).find(
      (s) => s.label === 'Bonus',
    )
    expect(added).toMatchObject({
      amount: m(1500),
      frequency: 'monthly',
      day: 10,
      anchorDate: null,
      walletId: 'main',
      categoryId: catId('salary'),
      autolog: false,
    })
  })

  it('tags the stream that sets the pay periods', async () => {
    render(<IncomeEditor id="salary" onClose={vi.fn()} onDelete={vi.fn()} />)
    expect(await screen.findByText('Sets my pay periods')).toBeTruthy()
    expect(screen.queryByText('Use for my pay periods')).toBeNull()
  })

  it('makes another stream the main paycheck when asked', async () => {
    const onClose = vi.fn()
    render(<IncomeEditor id={null} onClose={onClose} onDelete={vi.fn()} />)
    await screen.findByLabelText('What is it?')
    type('What is it?', 'Freelance')
    type('How much comes in?', '800')
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }))
    type('Next payday', '2026-10-09')
    expect(
      await screen.findByText('SR 800 weekly · next payday Oct 9.'),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('switch', { name: /Use for my pay periods/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add income' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const added = (await db.incomeStreams.toArray()).find(
      (s) => s.label === 'Freelance',
    )
    expect(added).toMatchObject({
      frequency: 'weekly',
      anchorDate: '2026-10-09',
      day: 9,
    })
    expect(
      (await db.balanceSettings.get(SETTINGS_KEY))?.mainIncomeStreamId,
    ).toBe(added?.id)
  })
})
