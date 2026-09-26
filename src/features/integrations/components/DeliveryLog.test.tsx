// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCatalog } from '#/features/categories/__fixtures__/categories'
import {
  PURCHASE_PAYLOAD,
  aDelivery,
  aRejection,
} from '#/features/integrations/__fixtures__/deliveries'
import { aKey } from '#/features/integrations/__fixtures__/keys'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { DeliveryLog } from './DeliveryLog'

const list = vi.fn()

vi.mock('#/features/integrations/api/integrationDeliveriesApi', () => ({
  integrationDeliveriesApi: { list: (id: string) => list(id) },
}))
vi.mock('#/features/inbound-imports/api/inboundImportsApi', () => ({
  inboundImportsApi: { getImport: vi.fn() },
}))

afterEach(cleanup)
beforeEach(() => list.mockReset())

const renderLog = (
  deliveries: Delivery[],
  onBuild = vi.fn(),
  online = true,
) => {
  list.mockResolvedValue(deliveries)
  render(
    <DeliveryLog
      apiKey={aKey()}
      online={online}
      walletNames={new Map()}
      catalog={defaultCatalog()}
      onBuild={onBuild}
    />,
  )
  return onBuild
}

describe('DeliveryLog', () => {
  it('shows a request refused for a wrong secret, and what to do about it', async () => {
    renderLog([aRejection('integrations.auth.invalid')])

    fireEvent.click(await screen.findByText('Refused — wrong secret'))

    expect(screen.getByText(/Copy the key into your app again/)).toBeDefined()
    expect(
      screen.getByText(/Nothing it sent is kept — the request didn’t prove/),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: /rule/i })).toBeNull()
  })

  it('says which field a rule failed to read, and why', async () => {
    renderLog([aDelivery()])

    fireEvent.click(
      await screen.findByText('Waiting for review — some fields weren’t found'),
    )

    expect(screen.getByText('Amount')).toBeDefined()
    expect(
      screen.getByText('Nothing at that path in this payload.'),
    ).toBeDefined()
    expect(screen.getByText(/but the pattern matched nothing/)).toBeDefined()
    expect(screen.getByText(/"event": "purchase"/)).toBeDefined()
  })

  it('hands the payload and its rule to the editor', async () => {
    const onBuild = renderLog([aDelivery()])

    fireEvent.click(await screen.findByText(/Waiting for review/))
    fireEvent.click(
      screen.getByRole('button', { name: 'Open its rule with this payload' }),
    )

    await waitFor(() => expect(onBuild).toHaveBeenCalledTimes(1))
    const [payload, delivery] = onBuild.mock.calls[0]
    expect(payload).toBe(PURCHASE_PAYLOAD)
    expect(delivery.ruleId).toBe('r1')
  })

  it('offers to build a new rule when no rule handled the delivery', async () => {
    const handled = aDelivery()
    renderLog([
      aDelivery({
        ruleId: null,
        ruleName: null,
        outcome: 'IGNORED',
        importId: null,
        report: handled.report && {
          ...handled.report,
          trace: [
            {
              index: 0,
              ruleId: 'r1',
              name: 'Refund',
              matched: false,
              detail: '$.event is "purchase"',
            },
          ],
        },
      }),
    ])

    fireEvent.click(await screen.findByText('No rule matched — nothing kept'))

    expect(
      screen.getByRole('button', { name: 'Build a rule from this' }),
    ).toBeDefined()
    expect(screen.getByText('$.event is "purchase"')).toBeDefined()
  })

  it('has nothing to fetch offline', () => {
    renderLog([], vi.fn(), false)
    expect(
      screen.getByText('You’re offline. The delivery log needs the server.'),
    ).toBeDefined()
    expect(list).not.toHaveBeenCalled()
  })
})
