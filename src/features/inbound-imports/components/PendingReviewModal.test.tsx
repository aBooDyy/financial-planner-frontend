// @vitest-environment jsdom
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
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import { catId } from '#/features/categories/__fixtures__/categories'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { UNDO_MS } from '#/features/inbound-imports/hooks/useHeldBatch'
import { PendingReviewModal } from './PendingReviewModal'

const confirmImport = vi.fn()
const dismissImport = vi.fn()
const getImport = vi.fn()

vi.mock('#/features/inbound-imports/data/mutations', () => ({
  confirmImport: (...args: unknown[]) => confirmImport(...args),
  dismissImport: (...args: unknown[]) => dismissImport(...args),
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

beforeEach(() => {
  confirmImport.mockReset().mockResolvedValue(undefined)
  dismissImport.mockReset().mockResolvedValue(undefined)
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

    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '212.40')
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
    expect(dismissImport).toHaveBeenCalledWith(READY, false)
  })

  it('asks the source to skip ones like it for Not a transaction', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderQueue([READY])

    fireEvent.click(screen.getByRole('button', { name: 'Not a transaction' }))
    expect(
      screen.getByText('Not a transaction — ones like it will be skipped'),
    ).toBeTruthy()
    expect(screen.getByText('All caught up')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS)
    })
    expect(dismissImport).toHaveBeenCalledWith(READY, true)
  })

  it('sends what is held at once when the review closes', () => {
    const { unmount } = renderQueue([READY])

    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    unmount()

    expect(dismissImport).toHaveBeenCalledWith(READY, false)
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
