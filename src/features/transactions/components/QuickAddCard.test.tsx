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
  income,
  m,
  planned,
  RATES,
  wallet,
} from '#/features/planned/testing/fixtures'
import { QuickAddCard } from './QuickAddCard'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

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

const HINT = 'Matches planned Salary (Sep 27) → Main Checking'

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
