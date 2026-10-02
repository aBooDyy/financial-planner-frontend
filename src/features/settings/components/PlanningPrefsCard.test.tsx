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
import { m, tx } from '#/features/planned/testing/fixtures'
import { seedPlanningDb, stubBrowser } from '#/features/planning/testing/dom'
import { PlanningPrefsCard } from './PlanningPrefsCard'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

const RATES = { SAR: 1 }
const stored = () => db.balanceSettings.get(SETTINGS_KEY)
const pick = async (select: string, option: string) => {
  fireEvent.click(await screen.findByRole('combobox', { name: select }))
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

beforeAll(stubBrowser)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 2, 12))
  await seedPlanningDb()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Settings › Planning', () => {
  it('starts on the defaults: until payday, review, steady', async () => {
    render(<PlanningPrefsCard base="SAR" rates={RATES} />)
    expect(
      (await screen.findByRole('combobox', { name: 'Safe to spend window' }))
        .textContent,
    ).toBe('Until next payday')
    expect(
      screen.getByRole('combobox', { name: 'When your pay arrives' })
        .textContent,
    ).toBe('Review what to set aside')
    expect(screen.queryByText(/Plan with at least/)).toBeNull()
  })

  it('looks a chosen number of days ahead, held to 7–90', async () => {
    render(<PlanningPrefsCard base="SAR" rates={RATES} />)
    await pick('Safe to spend window', 'Next N days')
    await waitFor(async () =>
      expect(await stored()).toMatchObject({
        safeHorizon: 'days',
        safeHorizonDays: 14,
      }),
    )
    const days = await screen.findByRole('textbox', { name: 'Days ahead' })
    fireEvent.change(days, { target: { value: '120' } })
    fireEvent.blur(days)
    await waitFor(async () =>
      expect((await stored())?.safeHorizonDays).toBe(90),
    )

    await pick('Safe to spend window', 'End of this month')
    await waitFor(async () =>
      expect(await stored()).toMatchObject({
        safeHorizon: 'end_of_month',
        safeHorizonDays: null,
      }),
    )
  })

  it('sets aside automatically when asked', async () => {
    render(<PlanningPrefsCard base="SAR" rates={RATES} />)
    await pick('When your pay arrives', 'Set aside automatically')
    await waitFor(async () => expect((await stored())?.paydayMode).toBe('auto'))
  })

  it('plans varying income from the lowest recent month, and takes an edit', async () => {
    await db.transactions.bulkPut([
      tx({ type: 'income', amount: m(9000), date: '2026-09-25' }),
      tx({ type: 'income', amount: m(6500), date: '2026-08-25' }),
    ])
    render(<PlanningPrefsCard base="SAR" rates={RATES} />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Varies' }))
    await waitFor(async () =>
      expect(await stored()).toMatchObject({
        incomeVaries: true,
        incomeFloor: m(6500),
      }),
    )
    expect(screen.getByText(/For freelancers, commission/)).toBeTruthy()
    const floor = screen.getByRole('textbox', {
      name: 'Plan with at least, a month',
    })
    expect((floor as HTMLInputElement).value).toBe('6,500.00')
    fireEvent.change(floor, { target: { value: '5000' } })
    fireEvent.blur(floor)
    await waitFor(async () =>
      expect((await stored())?.incomeFloor).toBe(m(5000)),
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Steady' }))
    await waitFor(async () =>
      expect(await stored()).toMatchObject({
        incomeVaries: false,
        incomeFloor: null,
      }),
    )
  })
})
