// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { aDelivery } from '#/features/integrations/__fixtures__/deliveries'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { useDeliveries } from './useDeliveries'

const list = vi.fn()

vi.mock('#/features/integrations/api/integrationDeliveriesApi', () => ({
  integrationDeliveriesApi: { list: (id: string) => list(id) },
}))

beforeEach(() => list.mockReset())

it('shows no rows of the previous key while the next key’s log loads', async () => {
  list.mockResolvedValueOnce([aDelivery({ id: 'd-k1' })])
  const { result, rerender } = renderHook(
    ({ keyId }) => useDeliveries(keyId, true),
    { initialProps: { keyId: 'k1' } },
  )
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.deliveries.map((d) => d.id)).toEqual(['d-k1'])

  let answer!: (rows: Delivery[]) => void
  list.mockReturnValueOnce(new Promise((res) => (answer = res)))
  rerender({ keyId: 'k2' })

  expect(result.current.status).toBe('loading')
  expect(result.current.deliveries).toEqual([])

  await act(async () => answer([aDelivery({ id: 'd-k2' })]))
  expect(result.current.deliveries.map((d) => d.id)).toEqual(['d-k2'])
})

it('keeps the rows on screen while a reload of the same key runs', async () => {
  list.mockResolvedValueOnce([aDelivery({ id: 'd1' })])
  const { result } = renderHook(() => useDeliveries('k1', true))
  await waitFor(() => expect(result.current.status).toBe('ready'))

  list.mockReturnValueOnce(new Promise(() => undefined))
  act(() => result.current.reload())

  expect(result.current.status).toBe('loading')
  expect(result.current.deliveries.map((d) => d.id)).toEqual(['d1'])
})
