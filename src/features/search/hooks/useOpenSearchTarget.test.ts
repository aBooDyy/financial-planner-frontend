// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchStore } from '#/features/search/stores/search'
import { useEntrySession } from '#/features/transactions/stores/entrySession'
import { useOpenSearchTarget } from './useOpenSearchTarget'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

const ID = '0192f0c4-7b1e-7c3a-9d2e-4f5a6b7c8d9e'

const open = (
  target: Parameters<ReturnType<typeof useOpenSearchTarget>>[0],
) => {
  const { result } = renderHook(() => useOpenSearchTarget())
  act(() => result.current(target))
}

beforeEach(() => {
  navigate.mockReset()
  act(() => useSearchStore.getState().openSearch())
})

describe('useOpenSearchTarget', () => {
  it('closes the sheet', () => {
    open({ kind: 'tx', id: ID })
    expect(useSearchStore.getState().open).toBe(false)
  })

  it('opens an item on its own tab', () => {
    open({ kind: 'budget', id: ID })
    expect(navigate).toHaveBeenCalledWith({
      to: '/transactions/$view',
      params: { view: 'budgets' },
      search: { open: `budget:${ID}` },
    })
  })

  it('opens a transfer by its transfer id', () => {
    open({ kind: 'transfer', transferId: ID })
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { view: 'activity' },
        search: { open: `transfer:${ID}` },
      }),
    )
  })

  it('makes an account the Spending filter', () => {
    open({ kind: 'account', id: ID })
    expect(useEntrySession.getState().scope).toEqual({ type: 'wallet', id: ID })
    expect(navigate).toHaveBeenCalledWith({
      to: '/transactions/$view',
      params: { view: 'activity' },
    })
  })
})
