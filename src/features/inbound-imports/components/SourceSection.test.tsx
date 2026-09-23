// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ImportDetail,
  InboundImport,
} from '#/features/inbound-imports/api/types'
import type { LedgerSource } from '#/features/inbound-imports/data/sources'
import { ReviewPayloadTree } from '#/features/integrations/components/ReviewPayloadTree'
import { PayloadViewContext } from './payloadView'
import { SourceSection } from './SourceSection'

const getImportByTransaction = vi.fn()

vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: {
    getImportByTransaction: (...args: unknown[]) =>
      getImportByTransaction(...args),
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

afterEach(cleanup)
beforeEach(() => getImportByTransaction.mockReset())

const imported = (over: Partial<InboundImport>): InboundImport => ({
  id: 'i1',
  source: 'inbox',
  connectionId: 'c1',
  keyId: null,
  merchantId: null,
  sourceRef: 'alerts@bank.example',
  sourceLabel: 'Al Rajhi Bank',
  subject: 'Purchase',
  occurredOn: '2026-09-23',
  amount: 15275,
  currency: 'SAR',
  suggestedMerchant: null,
  suggestedCategory: null,
  suggestedSubcategory: null,
  suggestedType: null,
  suggestedWalletId: null,
  rawPreview: null,
  hasBody: true,
  bodyFormat: 'text',
  status: 'confirmed',
  transactionId: 't1',
  createdAt: '2026-09-23T10:00:00Z',
  version: 'v1',
  ...over,
})

const open = (origin: LedgerSource, detail: ImportDetail) => {
  getImportByTransaction.mockResolvedValue(detail)
  render(
    <PayloadViewContext.Provider value={ReviewPayloadTree}>
      <SourceSection transactionId="t1" origin={origin} />
    </PayloadViewContext.Provider>,
  )
}

const WEBHOOK_DETAIL: ImportDetail = {
  import: imported({
    source: 'webhook',
    connectionId: null,
    keyId: 'k1',
    sourceLabel: 'Tasker — SMS alerts',
    bodyFormat: 'json',
  }),
  bodyLines: ['{"transaction":{"amount":"152.75"}}'],
  bodyTruncated: false,
  merchant: null,
}

describe('SourceSection', () => {
  it('shows the email an inbox entry came from', async () => {
    open(
      { kind: 'email', connectionId: 'c1' },
      {
        import: imported({}),
        bodyLines: ['Amount: SAR 152.75'],
        bodyTruncated: false,
        merchant: null,
      },
    )

    fireEvent.click(screen.getByRole('button', { name: /View source email/ }))

    expect(await screen.findByText('Amount: SAR 152.75')).toBeTruthy()
    expect(getImportByTransaction).toHaveBeenCalledWith('t1')
    expect(screen.queryByText(/Added by/)).toBeNull()
  })

  it('shows the payload a webhook entry came from, who sent it, and a way to its key', async () => {
    open({ kind: 'webhook', keyId: 'k1' }, WEBHOOK_DETAIL)

    fireEvent.click(screen.getByRole('button', { name: /View source payload/ }))

    expect(await screen.findByRole('tree', { name: 'Payload' })).toBeTruthy()
    expect(screen.getByText('Tasker — SMS alerts')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'View key' }).getAttribute('href'),
    ).toBe('/settings/integrations?key=k1')
    expect(screen.queryByRole('button', { name: 'Amount' })).toBeNull()
  })

  it('still shows the payload after the key was deleted, with no link to it', async () => {
    open({ kind: 'webhook', keyId: null }, WEBHOOK_DETAIL)

    fireEvent.click(screen.getByRole('button', { name: /View source payload/ }))

    expect(await screen.findByRole('tree')).toBeTruthy()
    expect(screen.getByText('Tasker — SMS alerts')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View key' })).toBeNull()
  })
})
