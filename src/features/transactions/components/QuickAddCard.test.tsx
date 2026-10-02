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
  afterAll,
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
  income,
  m,
  planned,
  RATES,
  setAside,
  wallet,
} from '#/features/planned/testing/fixtures'
import { isLiveSetAside } from '#/features/setAsides/data/totals'
import { useLeftoverPromptStore } from '#/features/transactions/stores/leftoverPrompt'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { QuickAddCard } from './QuickAddCard'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

// Mounting the portalled category popover in jsdom is slow when the suite runs in parallel.
vi.setConfig({ testTimeout: 20000 })

const SAVINGS = wallet({ id: 'w1', name: 'Savings' })
const MAIN = wallet({ id: 'w2', name: 'Main Checking' })

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 24, 12))
})

afterAll(() => {
  vi.useRealTimers()
})

afterEach(cleanup)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.categories.bulkPut(defaultCategoryRows())
  await db.balanceNodes.bulkPut([SAVINGS, MAIN])
  await db.incomeStreams.put(
    income({ id: 's1', label: 'Salary', amount: m(12000) }),
  )
  await db.plannedTransactions.put(
    planned({
      id: 'pay-sep',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 's1',
      walletId: 'w2',
      name: 'Salary',
      amount: m(12000),
      occurrence: '2026-09-27',
    }),
  )
})

const renderCard = () =>
  render(
    <QuickAddCard
      walletId="w1"
      currency="SAR"
      symbol="SR"
      wallets={[SAVINGS, MAIN]}
      base="SAR"
      rates={RATES}
    />,
  )

const typeAmount = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value } })

const HINT = 'Matches upcoming Salary (Sep 27) → Main Checking'

const saved = async () => {
  await waitFor(async () => expect(await db.transactions.count()).toBe(1))
  return (await db.transactions.toArray())[0]
}

describe('QuickAddCard · match hint', () => {
  it('shows nothing until the amount and type match a planned item', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    expect(screen.queryByText(HINT)).toBeNull()
    typeAmount('12000')
    expect(await screen.findByText(HINT)).toBeDefined()

    // A spend never settles a payday.
    fireEvent.click(screen.getByRole('button', { name: 'Spend' }))
    await waitFor(() => expect(screen.queryByText(HINT)).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    expect(await screen.findByText(HINT)).toBeDefined()
    typeAmount('11999')
    await waitFor(() => expect(screen.queryByText(HINT)).toBeNull())
  })

  it('settles the planned payday into its planned wallet, linked by default', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    typeAmount('12000')
    expect(
      await screen.findByRole('switch', { name: 'Link it' }),
    ).toHaveProperty('ariaChecked', 'true')

    fireEvent.click(screen.getByTitle('Add'))
    const tx = await saved()
    expect(tx.plannedId).toBe('pay-sep')
    expect(tx.walletId).toBe('w2')
    expect(tx.note).toBe('Salary')
    await waitFor(async () =>
      expect((await db.plannedTransactions.get('pay-sep'))?.status).toBe(
        'done',
      ),
    )
  })

  it('saves unlinked when the user turns the link off', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    typeAmount('12000')
    fireEvent.click(await screen.findByRole('switch', { name: 'Link it' }))

    fireEvent.click(screen.getByTitle('Add'))
    const tx = await saved()
    expect(tx.plannedId).toBeNull()
    expect(tx.walletId).toBe('w1')
    expect(tx.note).toBeNull()
    expect((await db.plannedTransactions.get('pay-sep'))?.status).toBe('open')
  })
})

describe('QuickAddCard · bill payments', () => {
  const held = (walletId: string, amount: number) =>
    setAside({
      goalId: null,
      billId: 'gym',
      occurrence: '2026-09-25',
      walletId,
      amount,
    })

  beforeEach(async () => {
    useLeftoverPromptStore.setState({ prompt: null })
    await db.bills.put(
      bill({
        id: 'gym',
        name: 'Gym',
        amount: m(200),
        nextDue: '2026-09-25',
        walletId: 'w2',
      }),
    )
    await db.plannedTransactions.put(
      planned({
        id: 'gym-sep',
        origin: 'bill',
        role: 'payment',
        goalId: null,
        billId: 'gym',
        walletId: 'w2',
        name: 'Gym',
        amount: m(200),
        occurrence: '2026-09-25',
      }),
    )
    await db.setAsides.bulkPut([held('w2', m(150)), held('w1', m(50))])
  })

  it('pays a matched bill like Pay now and raises the leftover prompt', async () => {
    renderCard()
    typeAmount('200')
    expect(
      await screen.findByText('Matches upcoming Gym (Sep 25) → Main Checking'),
    ).toBeDefined()

    fireEvent.click(screen.getByTitle('Add'))
    const tx = await saved()
    expect(tx).toMatchObject({ billId: 'gym', plannedId: 'gym-sep' })
    await waitFor(async () =>
      expect((await db.bills.get('gym'))?.nextDue).toBe('2026-10-25'),
    )
    const live = (await db.setAsides.toArray()).filter(isLiveSetAside)
    expect(live.map((a) => a.walletId)).toEqual(['w1'])
    await waitFor(() =>
      expect(useLeftoverPromptStore.getState().prompt).toMatchObject({
        payingWalletId: 'w2',
        report: { billId: 'gym', total: m(50) },
      }),
    )
  })
})

describe('QuickAddCard · category', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Element.prototype.scrollIntoView = () => {}
    Element.prototype.hasPointerCapture = () => false
  })

  it('files the entry under the picked subcategory', async () => {
    renderCard()
    fireEvent.click(
      await screen.findByRole('button', { name: 'More categories' }),
    )
    fireEvent.change(screen.getByPlaceholderText(/search categories/i), {
      target: { value: 'cafés' },
    })
    fireEvent.click(await screen.findByRole('option', { name: 'Cafés' }))
    expect(
      screen.getByRole('button', { name: 'Category: Dining · Cafés' }),
    ).toBeDefined()

    typeAmount('18')
    fireEvent.click(screen.getByTitle('Add'))
    const tx = await saved()
    expect(tx.categoryId).toBe(catId('cafes', 'dining'))
  })

  it('drops a pick that does not fit the new type', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    expect(
      await screen.findByRole('button', { name: 'Salary', pressed: true }),
    ).toBeDefined()
  })

  it('offers the first categories as one-tap chips before any history', async () => {
    renderCard()
    const group = await screen.findByRole('group', { name: 'Category' })
    const chips = within(group).getAllByRole('button', { pressed: false })
    expect(chips.length).toBeGreaterThan(0)
    expect(
      within(group).getByRole('button', { name: 'More categories' }),
    ).toBeDefined()
  })
})
