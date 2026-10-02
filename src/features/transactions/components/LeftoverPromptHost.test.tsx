// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useLeftoverPromptStore } from '#/features/transactions/stores/leftoverPrompt'
import { LeftoverPromptHost } from './LeftoverPromptHost'

vi.mock('#/db/sync', () => ({ schedulePush: () => undefined }))

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

afterEach(cleanup)

describe('LeftoverPromptHost', () => {
  it('shows the leftover prompt a saved bill payment raised, and nothing otherwise', async () => {
    render(<LeftoverPromptHost />)
    expect(screen.queryByText('Some money is left over')).toBeNull()

    act(() =>
      useLeftoverPromptStore.getState().show({
        report: {
          billId: 'gym',
          occurrence: '2026-09-25',
          lines: [
            {
              walletId: null,
              externalLabel: 'Envelope',
              amount: 5_000,
              currency: 'SAR',
              ids: ['a1'],
            },
          ],
          total: 5_000,
          canKeep: false,
          nextOccurrence: null,
        },
        payingWalletId: 'w2',
        date: '2026-09-24',
      }),
    )
    expect(await screen.findByText('Some money is left over')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Free it up' })).toBeTruthy()

    act(() => useLeftoverPromptStore.getState().dismiss())
    expect(screen.queryByText('Some money is left over')).toBeNull()
  })
})
