// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import type { ReactNode } from 'react'
import {
  act,
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
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import { bill, m, planned } from '#/features/planned/testing/fixtures'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { UNDO_MS } from '#/features/inbound-imports/hooks/useHeldBatch'
import { PendingReviewModal } from './PendingReviewModal'

vi.setConfig({ testTimeout: 20000 })

const confirmImport = vi.fn()
const dismissImport = vi.fn()
const linkConfirmed = vi.fn()
const getImport = vi.fn()

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))
vi.mock('#/features/inbound-imports/data/mutations', () => ({
  confirmImport: (...args: unknown[]) => confirmImport(...args),
  dismissImport: (...args: unknown[]) => dismissImport(...args),
  linkConfirmed: (...args: unknown[]) => linkConfirmed(...args),
}))
vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: {
    getImport: (...args: unknown[]) => getImport(...args),
  },
}))
vi.mock('#/features/inbound-imports/hooks/useRefreshQueue', () => ({
  useRefreshQueue: () => undefined,
}))
vi.mock('#/features/categories/hooks/useCategoryCatalog', async () => {
  const fixtures = await import('#/features/categories/__fixtures__/categories')
  const catalog = fixtures.defaultCatalog()
  return { useCategoryCatalog: () => catalog }
})
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string
    search: Record<string, string>
    children: ReactNode
  }) => (
    <a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>
  ),
}))

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

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const WALLETS = [
  { id: 'w1', name: 'Main Checking', currency: 'SAR', color: '#1F9D6B' },
] as LocalBalanceNode[]

const EMAIL = [
  'Dear customer,',
  'Purchase of SAR 38.50',
  'at STARBUCKS RIYADH',
  'Available balance SAR 12,300.10',
]

const row = (over: Partial<LocalInboundImport> = {}): LocalInboundImport => ({
  id: 'r1',
  source: 'inbox',
  connectionId: 'c1',
  keyId: null,
  ruleId: 'rule1',
  merchantId: null,
  sourceRef: 'alerts@alrajhibank.com.sa',
  sourceLabel: 'Al Rajhi Bank',
  subject: 'Card purchase',
  occurredOn: '2026-09-25',
  amount: 3850,
  currency: 'SAR',
  suggestedMerchant: 'STARBUCKS RIYADH',
  suggestedCategoryId: catId('dining'),
  suggestedType: 'spend',
  suggestedWalletId: 'w1',
  rawPreview: null,
  hasBody: true,
  bodyFormat: 'text',
  skippable: true,
  status: 'pending',
  transactionId: null,
  createdAt: '2026-09-25T09:12:00Z',
  version: 'v1',
  ...over,
})

const READY = row()
const NEEDS = row({
  id: 'r2',
  amount: null,
  suggestedMerchant: null,
  subject: 'Card purchase',
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.bills.put(
    bill({ id: 'rent', name: 'Rent', amount: m(3500), nextDue: '2026-10-01' }),
  )
  await db.plannedTransactions.put(
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
  )
  confirmImport.mockReset().mockResolvedValue('tx1')
  dismissImport.mockReset().mockResolvedValue(undefined)
  linkConfirmed.mockReset().mockResolvedValue(null)
  getImport.mockReset().mockImplementation(
    (id: string): Promise<ImportDetail> =>
      Promise.resolve({
        import: id === 'r2' ? NEEDS : READY,
        bodyLines:
          id === 'r2'
            ? ['Purchase at PANDA HYPER', 'Amount: SAR 212.40']
            : EMAIL,
        bodyTruncated: false,
        merchant: null,
      }),
  )
})

const renderQueue = (imports: LocalInboundImport[]) =>
  render(
    <PendingReviewModal
      imports={imports}
      wallets={WALLETS}
      goals={[]}
      onClose={vi.fn()}
    />,
  )

describe('PendingReviewModal', () => {
  it('shows one import at a time, and what the queue still needs', async () => {
    renderQueue([READY, NEEDS])

    expect(
      screen.getByText(
        '2 imports to review — 1 needs details filled in by hand',
      ),
    ).toBeTruthy()
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(screen.getByText('Starbucks Riyadh')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm all · 1' })).toBeTruthy()
    expect(
      screen.getByText('1 still needs details and stays in the queue.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next import' }))
    expect(screen.getByText('2 of 2')).toBeTruthy()
    expect(screen.getByText('Needs details')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Confirm & add' }),
    ).toHaveProperty('disabled', true)
    await screen.findByRole('button', { name: 'Use “212.40” as the amount' })
  })

  it('highlights what was read in the email, with a link to fix the rule', async () => {
    renderQueue([READY])

    fireEvent.click(screen.getByRole('button', { name: /More details/ }))
    const email = screen.getByRole('button', { name: /Card purchase/ })
    expect(email.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(email)

    await screen.findByRole('button', { name: 'Use “12,300.10” as the amount' })
    const tags = screen.getAllByText(/^(Amount|Currency|Merchant)$/, {
      selector: 'span span',
    })
    expect(tags.map((t) => t.textContent).sort()).toEqual([
      'Amount',
      'Currency',
      'Merchant',
    ])
    expect(
      screen.getByRole('link', { name: /Fix the rule/ }).getAttribute('href'),
    ).toBe('/settings/email-sync?inbox=c1&sample=r1&rule=rule1')
  })

  it('fills the amount from a number tapped in the email', async () => {
    renderQueue([NEEDS])

    fireEvent.click(
      await screen.findByRole('button', { name: 'Use “212.40” as the amount' }),
    )

    expect(screen.getByLabelText('How much did you spend?')).toHaveProperty(
      'value',
      '212.40',
    )
    expect(
      screen.getByRole('button', { name: 'Confirm & add' }),
    ).toHaveProperty('disabled', false)
  })

  it('names a merchant from the words around the one tapped', async () => {
    renderQueue([NEEDS])

    fireEvent.click(await screen.findByRole('button', { name: /^Merchant/ }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Use “HYPER” as the merchant' }),
    )

    expect(
      screen.getByLabelText(/Merchant/, { selector: 'input' }),
    ).toHaveProperty('value', 'Panda Hyper')
  })

  it('holds Ignore for an Undo before it reaches the server', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderQueue([READY, NEEDS])

    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    expect(screen.getByText('Import ignored')).toBeTruthy()
    expect(screen.getByText('1 of 1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('1 of 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS)
    })
    expect(dismissImport).toHaveBeenCalledTimes(1)
    expect(dismissImport).toHaveBeenCalledWith(READY)
  })

  it('keeps the card to amount, category and note, the rest folded', () => {
    renderQueue([READY])

    expect(screen.getByLabelText('How much did you spend?')).toBeTruthy()
    expect(screen.getByLabelText(/Note/, { selector: 'input' })).toBeTruthy()
    expect(
      screen.queryByLabelText(/Merchant/, { selector: 'input' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Not a transaction' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /More details/ }))
    expect(
      screen.getByLabelText(/Merchant/, { selector: 'input' }),
    ).toBeTruthy()
  })

  it('links an import to the bill its amount and date match', async () => {
    const rent = row({ amount: m(3500), occurredOn: '2026-10-01' })
    renderQueue([rent])

    expect(
      await screen.findByText('Matches upcoming Rent (Oct 1)'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & add' }))

    await waitFor(() =>
      expect(linkConfirmed).toHaveBeenCalledWith('tx1', {
        plannedId: 'rent-oct',
        goalId: null,
        billId: 'rent',
      }),
    )
  })

  it('confirms unlinked once the bill match is switched off', async () => {
    renderQueue([row({ amount: m(3500), occurredOn: '2026-10-01' })])

    fireEvent.click(
      await screen.findByRole('switch', { name: 'Link to the upcoming item' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & add' }))

    await waitFor(() =>
      expect(linkConfirmed).toHaveBeenCalledWith('tx1', {
        plannedId: null,
        goalId: null,
        billId: null,
      }),
    )
  })

  it('counts toward a bill picked under More details', async () => {
    renderQueue([READY])

    fireEvent.click(screen.getByRole('button', { name: /More details/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: /Counts toward: Nothing/ }),
    )
    fireEvent.click(await screen.findByRole('option', { name: /Rent/ }))
    expect(
      await screen.findByRole('button', { name: /Counts toward: Rent/ }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & add' }))

    await waitFor(() =>
      expect(linkConfirmed).toHaveBeenCalledWith(
        'tx1',
        expect.objectContaining({ billId: 'rent' }),
      ),
    )
  })

  it('sends what is held at once when the review closes', () => {
    const { unmount } = renderQueue([READY])

    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    unmount()

    expect(dismissImport).toHaveBeenCalledWith(READY)
  })

  it('confirms every ready import and leaves the rest', async () => {
    renderQueue([READY, NEEDS])

    fireEvent.click(screen.getByRole('button', { name: 'Confirm all · 1' }))

    await waitFor(() => expect(confirmImport).toHaveBeenCalledTimes(1))
    expect(confirmImport).toHaveBeenCalledWith(
      READY,
      expect.objectContaining({
        walletId: 'w1',
        categoryId: catId('dining'),
        amount: 3850,
        currency: 'SAR',
        merchant: undefined,
      }),
    )
    expect(await screen.findByText('1 added to your ledger')).toBeTruthy()
  })
})
