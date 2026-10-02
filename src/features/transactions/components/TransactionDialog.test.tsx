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
import { transferWallets } from '#/features/wallets/data/transferDialog'
import {
  bill,
  goal,
  income,
  m,
  planned,
  RATES,
  wallet,
} from '#/features/planned/testing/fixtures'
import type {
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { catId } from '#/features/categories/__fixtures__/categories'
import { TransactionDialog } from './TransactionDialog'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

vi.setConfig({ testTimeout: 20000 })

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
const RENT = bill({
  id: 'rent',
  name: 'Rent',
  amount: m(3500),
  nextDue: '2026-10-01',
})
const UMRAH = goal({ id: 'umrah', name: 'Umrah trip', target: m(13000) })
const GOALS: LocalGoal[] = [UMRAH]

const draft = (over: Partial<TxEditorDraft>): TxEditorDraft => ({
  type: 'spend',
  amount: '3500',
  categoryId: catId('housing'),
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
  scopeType: 'category',
  period: 'monthly',
  customDays: '30',
  limit: '',
  currency: 'SAR',
  excludesBills: false,
  ...over,
})

const renderDialog = (
  over: Partial<TxEditorDraft>,
  {
    id = null,
    wallets = [MAIN],
  }: { id?: string | null; wallets?: (typeof MAIN)[] } = {},
) => {
  const props = {
    onSave: vi.fn(),
    onGoal: vi.fn(),
    onField: vi.fn(),
  }
  const editing: TxEditorState = { kind: 'tx', id, draft: draft(over) }
  render(
    <TransactionDialog
      editing={editing}
      accounts={transferWallets(wallets, {}, 'SAR')}
      accountSections={[
        {
          label: 'Wallets',
          options: wallets.map((w) => ({
            value: `wallet:${w.id}`,
            kind: 'wallet' as const,
            name: w.name,
            amountStr: 'SR 0',
            color: w.color,
            icon: null,
            depth: 0,
          })),
        },
      ]}
      archivedIds={new Set()}
      goals={GOALS}
      rates={RATES}
      base="SAR"
      onField={props.onField}
      onType={vi.fn()}
      onSwapTransfer={vi.fn()}
      onResetReceived={vi.fn()}
      onCategory={vi.fn()}
      onGoal={props.onGoal}
      onMerchant={vi.fn()}
      onApplySuggestion={vi.fn()}
      onSave={props.onSave}
      onDelete={vi.fn()}
      onClose={vi.fn()}
      onAddWallet={vi.fn()}
    />,
  )
  return props
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.balanceNodes.put(MAIN)
  await db.goals.bulkPut(GOALS)
  await db.bills.put(RENT)
  await db.incomeStreams.put(
    income({ id: 's1', label: 'Salary', amount: m(12000) }),
  )
  await db.plannedTransactions.bulkPut([
    planned({
      id: 'rent-oct',
      origin: 'bill',
      role: 'payment',
      goalId: null,
      billId: 'rent',
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

describe('TransactionDialog · planned links', () => {
  it('links a new spend to the bill its amount and date match, unless switched off', async () => {
    const { onSave } = renderDialog({ amount: '3400' })
    expect(await screen.findByText('Matches planned Rent (Oct 1)')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Counts toward: Rent/ }),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({
      plannedId: 'rent-oct',
      goalId: null,
      billId: 'rent',
    })

    fireEvent.click(
      screen.getByRole('switch', { name: 'Link to the planned item' }),
    )
    expect(
      screen.getByText('Saves as regular spending. Rent stays planned.'),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({
      plannedId: null,
      goalId: null,
      billId: null,
    })
  })

  it('does not guess for an amount far from any bill', async () => {
    const { onSave } = renderDialog({ amount: '120' })
    expect(
      await screen.findByRole('button', { name: /Counts toward: Nothing/ }),
    ).toBeTruthy()
    expect(screen.queryByText(/Matches planned/)).toBeNull()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({
      plannedId: null,
      goalId: null,
      billId: null,
    })
  })

  it('picks from the list inside the dialog and returns to the form', async () => {
    const { onGoal } = renderDialog({ amount: '120' })
    fireEvent.click(
      await screen.findByRole('button', { name: /Counts toward: Nothing/ }),
    )
    expect(screen.getByRole('heading', { name: 'Counts toward' })).toBeTruthy()
    const umrah = await screen.findByRole('option', { name: /Umrah trip/ })
    expect(umrah.textContent).toContain('Goal · SR 0 of SR 13,000')
    fireEvent.click(umrah)
    expect(onGoal).toHaveBeenCalledWith('umrah')
    expect(
      screen.getByRole('heading', { name: 'New transaction' }),
    ).toBeTruthy()
  })

  it('points a saving goal to Add contribution instead of linking a set-aside', async () => {
    const { onSave } = renderDialog({ goalId: 'umrah', amount: '120' })
    expect(
      await screen.findByText(/on the goal\.$/, { selector: 'p' }),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({
      plannedId: null,
      goalId: 'umrah',
      billId: null,
    })
  })

  it('finds an income entry’s payday and hides the stream row', async () => {
    const { onSave } = renderDialog({
      type: 'income',
      categoryId: catId('salary'),
      amount: '12000',
      date: '2026-09-27',
    })
    expect(
      await screen.findByText('Matches planned Salary (Sep 27)'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Counts toward/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Choose another stream' }),
    ).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).toHaveBeenLastCalledWith({
      plannedId: 'pay-sep',
      goalId: null,
      billId: null,
    })
  })
})

describe('TransactionDialog · pickers', () => {
  it('opens the category list inside the dialog and picks from it', async () => {
    renderDialog({ amount: '120' })
    fireEvent.click(
      await screen.findByRole('button', { name: /All categories/ }),
    )
    expect(screen.getByRole('heading', { name: 'Category' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search categories…')).toBeTruthy()
  })
})

describe('TransactionDialog · readiness', () => {
  it('says what is missing and marks it when Add is pressed too early', async () => {
    const { onSave } = renderDialog({ amount: '' })
    expect(await screen.findByText('Add an amount to continue')).toBeTruthy()
    fireEvent.click(addButton())
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Enter an amount above 0.')).toBeTruthy()
  })

  it('points to adding a wallet when there is none', async () => {
    renderDialog({ amount: '50', walletId: '' }, { wallets: [] })
    expect(await screen.findByText('Pick a wallet first')).toBeTruthy()
    fireEvent.click(addButton())
    expect(screen.getByRole('button', { name: 'Add a wallet' })).toBeTruthy()
  })

  it('blocks a transfer between the same account', async () => {
    renderDialog({ type: 'transfer', amount: '500', toWalletId: 'w1' })
    expect(await screen.findByText('Pick two different accounts.')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: /^Save transfer/ })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('edits keep their shape: titled by type, transfer locked, deletable', async () => {
    renderDialog({ amount: '120' }, { id: 't1' })
    expect(
      await screen.findByRole('heading', { name: 'Edit spend' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { name: 'Transfer' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy(),
    )
  })
})

describe('TransactionDialog · a row that did not sync', () => {
  const flag = (field: string | null) =>
    db.outbox.add({
      op: 'update',
      entity: 'transaction',
      id: 't1',
      payload: {},
      baseVersion: 'v1',
      createdAt: '2026-09-26T10:00:00.000Z',
      failure: {
        kind: 'rejected',
        status: 422,
        code: 'spending.transaction.category_invalid',
        field,
        message: 'Category not found.',
        at: '2026-09-26T10:00:00.000Z',
      },
      attempts: 1,
      nextAttemptAt: '2026-09-26T10:01:00.000Z',
    })

  it('leads with why, what to do, and Retry now', async () => {
    await flag('category_id')
    renderDialog({ amount: '120' }, { id: 't1' })
    const banner = await screen.findByRole('alert')
    expect(banner.textContent).toContain('Category no longer available')
    expect(banner.textContent).toContain('Pick another category and save.')
    expect(screen.getByRole('button', { name: 'Retry now' })).toBeTruthy()
  })

  it('marks the field the server named', async () => {
    await flag('category_id')
    renderDialog({ amount: '120' }, { id: 't1' })
    await screen.findByRole('alert')
    expect(
      screen
        .getByRole('group', { name: 'What for?' })
        .getAttribute('data-invalid'),
    ).toBe('true')
    expect(
      screen.getByRole('group', { name: 'When?' }).hasAttribute('data-invalid'),
    ).toBe(false)
  })

  it('shows nothing for a row that synced', async () => {
    renderDialog({ amount: '120' }, { id: 't1' })
    await screen.findByRole('heading', { name: 'Edit spend' })
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull()
  })
})
