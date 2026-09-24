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
import type { LocalGoal } from '#/db/types'
import {
  goal,
  income,
  m,
  planned,
  wallet,
} from '#/features/planned/testing/fixtures'
import type {
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { TxEditor } from './TxEditor'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  Element.prototype.hasPointerCapture = () => false
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

afterEach(cleanup)

const MAIN = wallet({ id: 'w1', name: 'Main Checking' })
const RENT = goal({
  id: 'rent',
  name: 'Rent',
  kind: 'recurring',
  amount: m(3500),
  nextDue: '2026-10-01',
})
const UMRAH = goal({ id: 'umrah', name: 'Umrah trip', target: m(13000) })
const GOALS: LocalGoal[] = [RENT, UMRAH]

const draft = (over: Partial<TxEditorDraft>): TxEditorDraft => ({
  type: 'spend',
  amount: '3500',
  category: 'housing',
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  plannedId: null,
  merchantId: null,
  merchantName: '',
  date: '2026-10-01',
  note: '',
  toWalletId: '',
  toAmount: '',
  toAmountEdited: false,
  name: '',
  frequency: 'monthly',
  autopost: false,
  scopeType: 'category',
  target: '',
  period: 'monthly',
  customDays: '30',
  limit: '',
  currency: 'SAR',
  ...over,
})

const renderEditor = (
  over: Partial<TxEditorDraft>,
  goals: LocalGoal[] = GOALS,
) => {
  const onSave = vi.fn()
  const onGoal = vi.fn()
  const editing: TxEditorState = { kind: 'tx', id: null, draft: draft(over) }
  render(
    <TxEditor
      editing={editing}
      wallets={[MAIN]}
      goals={goals}
      onField={vi.fn()}
      onType={vi.fn()}
      onSwapTransfer={vi.fn()}
      base="SAR"
      onCategory={vi.fn()}
      onGoal={onGoal}
      onMerchant={vi.fn()}
      onApplySuggestion={vi.fn()}
      onScopeType={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  return { onSave, onGoal }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.balanceNodes.put(MAIN)
  await db.goals.bulkPut(GOALS)
  await db.incomeStreams.put(
    income({ id: 's1', label: 'Salary', amount: m(12000) }),
  )
  await db.plannedTransactions.bulkPut([
    planned({
      id: 'rent-oct',
      role: 'payment',
      goalId: 'rent',
      name: 'Rent',
      amount: m(3500),
      occurrence: '2026-10-01',
    }),
    planned({
      id: 'pay-sep',
      origin: 'income',
      role: 'income',
      goalId: null,
      incomeStreamId: 's1',
      name: 'Salary',
      amount: m(12000),
      occurrence: '2026-09-27',
    }),
  ])
})

const addButton = () => screen.getByRole('button', { name: 'Add' })

describe('TxEditor · Counts toward', () => {
  it('offers Nothing plus the goals, and picking one goes through onGoal', async () => {
    const { onGoal } = renderEditor({})
    expect(screen.getByRole('radio', { name: /Nothing/ })).toHaveProperty(
      'ariaChecked',
      'true',
    )
    const rent = await screen.findByRole('radio', { name: /Rent/ })
    expect(rent.textContent).toContain('Obligation · SR 3,500 due Oct 1')
    fireEvent.click(rent)
    expect(onGoal).toHaveBeenCalledWith('rent')
  })

  it('settles the matching planned payment unless "Don’t link"', async () => {
    const { onSave } = renderEditor({ goalId: 'rent' })
    expect(
      await screen.findByText(
        /^Matches the planned Oct 1 payment \(SR 3,500\.00\)/,
      ),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({ plannedId: 'rent-oct' })

    fireEvent.click(screen.getByRole('switch', { name: 'Don’t link' }))
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({ plannedId: null })
  })

  it('points a saving goal to Add contribution instead of linking a set-aside', async () => {
    const { onSave } = renderEditor({ goalId: 'umrah' })
    expect(
      await screen.findByText(/use Add contribution on the goal/),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({ plannedId: null })
  })

  it('lists income streams for income and settles the planned payday', async () => {
    const { onSave } = renderEditor({
      type: 'income',
      category: 'salary',
      amount: '12000',
      date: '2026-09-27',
    })
    fireEvent.click(await screen.findByRole('radio', { name: /Salary/ }))
    await waitFor(() =>
      expect(
        screen.getByText(/^Matches the planned Sep 27 payday/),
      ).toBeTruthy(),
    )
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({ plannedId: 'pay-sep' })
  })

  it('finds a goal past the top five through the searchable More…', async () => {
    const many = [
      ...GOALS,
      ...['Car', 'Laptop', 'Wedding', 'Garden', 'Piano'].map((name, i) =>
        goal({ id: name.toLowerCase(), name, position: i + 2 }),
      ),
    ]
    const { onGoal } = renderEditor({}, many)
    fireEvent.click(await screen.findByRole('button', { name: 'More' }))
    fireEvent.change(
      screen.getByPlaceholderText('Search goals & obligations…'),
      {
        target: { value: 'pia' },
      },
    )
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Piano'),
    ])
    fireEvent.click(options[0])
    expect(onGoal).toHaveBeenCalledWith('piano')
  })
})
