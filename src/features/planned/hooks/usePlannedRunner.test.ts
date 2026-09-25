// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notePlannerInputsPulled, resetPullState } from '#/db/pullState'
import { requestPlanRecalc } from '#/features/planned/data/recalcRequests'
import { useSessionStore } from '#/stores/session'
import { usePlannedRunner } from './usePlannedRunner'

const runPlanner = vi.fn()
vi.mock('#/features/planned/data/runner', () => ({
  runPlanner: (...args: unknown[]) => runPlanner(...args),
}))

const signIn = () =>
  useSessionStore.getState().setUser({
    id: 'u1',
    email: 'a@b.c',
    onboardedAt: '2026-01-01T00:00:00Z',
    name: 'A',
    createdAt: '',
    updatedAt: '',
    version: '',
  })

afterEach(cleanup)

beforeEach(() => {
  runPlanner.mockReset().mockResolvedValue(undefined)
  resetPullState()
  useSessionStore.getState().clear()
})

describe('usePlannedRunner', () => {
  it('waits for the first pull of the planner’s inputs before generating anything', async () => {
    signIn()
    renderHook(() => usePlannedRunner())
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(runPlanner).not.toHaveBeenCalled()

    act(() => notePlannerInputsPulled())

    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(1))
    expect(runPlanner.mock.calls[0][0]).toBe('u1')
  })

  it('never runs without a session', async () => {
    renderHook(() => usePlannedRunner())
    act(() => notePlannerInputsPulled())
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(runPlanner).not.toHaveBeenCalled()
  })

  it('runs again when a plan rewrite is requested', async () => {
    signIn()
    renderHook(() => usePlannedRunner())
    act(() => notePlannerInputsPulled())
    await waitFor(() => expect(runPlanner).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 700))
    const settled = runPlanner.mock.calls.length

    act(() => requestPlanRecalc('g1'))

    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(settled + 1))
  })
})
