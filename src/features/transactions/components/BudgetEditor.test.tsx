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
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import { db } from '#/db/db'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import { bill, income, m, wallet } from '#/features/planned/testing/fixtures'
import type {
  TxEditorDraft,
  TxEditorState,
} from '#/features/transactions/hooks/useTxEditor'
import { BudgetEditor } from './BudgetEditor'

vi.setConfig({ testTimeout: 20000 })

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 30, 12))
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
  await db.categories.bulkPut(defaultCategoryRows())
  await db.bills.put(
    bill({
      id: 'rent',
      name: 'Rent',
      amount: m(3_000),
      categoryId: catId('rent', 'housing'),
    }),
  )
})

afterEach(async () => {
  cleanup()
  await db.incomeStreams.clear()
})

afterAll(() => {
  vi.useRealTimers()
})

const MAIN = wallet({ id: 'w1', name: 'Main' })

const draft = (over: Partial<TxEditorDraft> = {}): TxEditorDraft => ({
  type: 'spend',
  amount: '',
  categoryId: catId('housing'),
  walletId: 'w1',
  goalId: null,
  plannedId: null,
  merchantId: null,
  merchantName: '',
  date: '2026-10-30',
  note: '',
  toWalletId: '',
  toAmount: '',
  toAmountEdited: false,
  scopeType: 'category',
  period: 'monthly',
  customDays: '30',
  limit: '1500',
  currency: 'SAR',
  excludesBills: false,
  ...over,
})

const renderEditor = (over: Partial<TxEditorDraft> = {}, onField = vi.fn()) => {
  const editing: TxEditorState = {
    kind: 'budget',
    id: null,
    draft: draft(over),
  }
  render(
    <TooltipProvider>
      <BudgetEditor
        editing={editing}
        wallets={[MAIN]}
        archivedWalletIds={new Set()}
        onField={onField}
        onScopeType={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    </TooltipProvider>,
  )
  return onField
}

describe('BudgetEditor', () => {
  it('offers Weekly, Monthly, Per paycheck and Custom', () => {
    const onField = renderEditor()
    for (const name of ['Weekly', 'Monthly', 'Per paycheck', 'Custom'])
      expect(screen.getByRole('button', { name })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Per paycheck' }))
    expect(onField).toHaveBeenCalledWith('period', 'paycheck')
  })

  it('shows the pay period a per-paycheck budget resets on', async () => {
    await db.incomeStreams.put(income({ amount: m(9_000), day: 25 }))
    renderEditor({ period: 'paycheck' })
    expect(
      await screen.findByText('Resets every payday · Oct 25 – Nov 24'),
    ).toBeTruthy()
  })

  it('says a per-paycheck budget resets monthly until there is income', async () => {
    renderEditor({ period: 'paycheck' })
    expect(
      await screen.findByText(
        'Add your income to budget per paycheck — until then this resets monthly.',
      ),
    ).toBeTruthy()
  })

  it('leaves planned bills in by default, and names the bills it would leave out', async () => {
    const onField = renderEditor()
    const toggle = screen.getByRole('switch', {
      name: /Leave out planned bills/,
    })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await waitFor(() =>
      expect(
        screen.getByText('Rent (SR 3,000) is planned as a bill in Housing.'),
      ).toBeTruthy(),
    )
    fireEvent.click(toggle)
    expect(onField).toHaveBeenCalledWith('excludesBills', true)
  })
})
