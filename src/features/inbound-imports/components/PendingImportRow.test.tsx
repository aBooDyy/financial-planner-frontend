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
import { buildCatalog } from '#/features/categories/data/catalog'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { ReviewPayloadTree } from '#/features/integrations/components/ReviewPayloadTree'
import { DISMISS_UNDO_MS } from '#/features/inbound-imports/hooks/useUndoableDismiss'
import { PendingImportRow } from './PendingImportRow'
import { PayloadViewContext } from './payloadView'

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

afterEach(cleanup)

beforeEach(() => {
  confirmImport.mockReset().mockResolvedValue(undefined)
  dismissImport.mockReset().mockResolvedValue(undefined)
  getImport.mockReset()
})

const WALLETS = [
  { id: 'w1', name: 'Main', currency: 'SAR' },
  { id: 'w2', name: 'Visa', currency: 'SAR' },
] as LocalBalanceNode[]

const PAYLOAD = {
  event: 'purchase',
  transaction: { amount: '38.00', currency: 'SAR' },
  body: 'Purchase at CARREFOUR HYPER 4471 on card',
}

const webhookRow = (
  over: Partial<LocalInboundImport> = {},
): LocalInboundImport => ({
  id: 'i1',
  source: 'webhook',
  connectionId: null,
  keyId: 'k1',
  ruleId: null,
  merchantId: null,
  sourceRef: 'fpk_7f3a9c21',
  sourceLabel: 'Tasker — SMS alerts',
  subject: null,
  occurredOn: '2026-09-23',
  amount: null,
  currency: null,
  suggestedMerchant: null,
  suggestedCategory: null,
  suggestedSubcategory: null,
  suggestedType: 'spend',
  suggestedWalletId: 'w2',
  rawPreview: JSON.stringify(PAYLOAD),
  hasBody: true,
  bodyFormat: 'json',
  status: 'pending',
  transactionId: null,
  createdAt: '2026-09-23T10:00:00Z',
  version: 'v1',
  ...over,
})

const detailOf = (item: LocalInboundImport): ImportDetail => ({
  import: item,
  bodyLines: [JSON.stringify(PAYLOAD)],
  bodyTruncated: false,
  merchant: null,
})

const renderRow = (item: LocalInboundImport) => {
  getImport.mockResolvedValue(detailOf(item))
  return render(
    <PayloadViewContext.Provider value={ReviewPayloadTree}>
      <PendingImportRow
        item={item}
        wallets={WALLETS}
        catalog={buildCatalog([])}
      />
    </PayloadViewContext.Provider>,
  )
}

describe('PendingImportRow — a webhook row', () => {
  it('says where it came from: the bolt and the key’s name', () => {
    renderRow(webhookRow({ amount: 3800, currency: 'SAR' }))

    expect(screen.getByRole('img', { name: 'From a webhook' })).toBeTruthy()
    expect(screen.getByText('Tasker — SMS alerts · Sep 23')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /View payload & details/ }),
    ).toBeTruthy()
  })

  it('opens on its payload when it needs details, with a way to fix the rule', async () => {
    renderRow(webhookRow())

    expect(await screen.findByRole('tree', { name: 'Payload' })).toBeTruthy()
    expect(getImport).toHaveBeenCalledWith('i1')
    expect(screen.getByText('Needs details')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Fix the rule/ }).getAttribute('href'),
    ).toBe('/settings/integrations?key=k1&sample=i1')
  })

  it('offers no rule fix once its key is gone', async () => {
    renderRow(webhookRow({ keyId: null }))

    await screen.findByRole('tree')
    expect(screen.queryByRole('link', { name: /Fix the rule/ })).toBeNull()
  })

  it('is filled by tapping the payload and confirms into the ledger', async () => {
    renderRow(webhookRow())
    await screen.findByRole('tree')

    fireEvent.click(screen.getByText('"38.00"'))
    fireEvent.click(screen.getByText('"SAR"'))
    fireEvent.click(screen.getByRole('button', { name: 'Merchant' }))
    fireEvent.click(screen.getByText('CARREFOUR'))

    expect(screen.getByDisplayValue('38')).toBeTruthy()
    expect(screen.getByDisplayValue('CARREFOUR HYPER 4471')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm & add' }))
    })

    await waitFor(() => expect(confirmImport).toHaveBeenCalledTimes(1))
    expect(confirmImport.mock.calls[0][1]).toMatchObject({
      walletId: 'w2',
      type: 'spend',
      amount: 3800,
      currency: 'SAR',
      date: '2026-09-23',
      merchant: 'CARREFOUR HYPER 4471',
    })
  })
})

describe('PendingImportRow — an inbox row', () => {
  it('keeps the envelope and the email copy', () => {
    renderRow(
      webhookRow({
        source: 'inbox',
        keyId: null,
        ruleId: null,
        connectionId: 'c1',
        sourceLabel: 'Al Rajhi Bank',
        bodyFormat: 'text',
        amount: 15275,
        currency: 'SAR',
      }),
    )

    expect(screen.getByRole('img', { name: 'From an email' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /View email & details/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Fix the rule/ })).toBeNull()
  })

  it('offers its inbox’s rule editor, on this email, when it could not be read', async () => {
    renderRow(
      webhookRow({
        source: 'inbox',
        keyId: null,
        ruleId: 'r9',
        connectionId: 'c1',
        sourceLabel: 'Al Rajhi Bank',
        bodyFormat: 'text',
      }),
    )

    const link = await screen.findByRole('link', { name: /Fix the rule/ })
    expect(link.getAttribute('href')).toBe(
      '/settings/email-sync?inbox=c1&sample=i1&rule=r9',
    )
  })
})

describe('PendingImportRow — not a transaction', () => {
  afterEach(() => vi.useRealTimers())

  it('can be taken back before it is sent, and is sent once the moment passes', async () => {
    vi.useFakeTimers()
    renderRow(webhookRow({ amount: 3800, currency: 'SAR' }))

    fireEvent.click(screen.getByRole('button', { name: 'Not a transaction' }))
    expect(screen.getByText('Marked as not a transaction.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Confirm & add' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Not a transaction' }))
    await act(async () => {
      vi.advanceTimersByTime(DISMISS_UNDO_MS)
    })
    expect(dismissImport).toHaveBeenCalledTimes(1)
  })

  it('is sent at once when the review closes', () => {
    const { unmount } = renderRow(webhookRow({ amount: 3800, currency: 'SAR' }))

    fireEvent.click(screen.getByRole('button', { name: 'Not a transaction' }))
    expect(dismissImport).not.toHaveBeenCalled()
    unmount()
    expect(dismissImport).toHaveBeenCalledTimes(1)
  })
})
