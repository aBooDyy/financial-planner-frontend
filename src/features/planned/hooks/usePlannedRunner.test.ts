// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import {
  plannerInputsOnDevice,
  recordPlannerInputsPulled,
} from '#/db/plannerInputs'
import { notePlannerInputsPulled, resetPullState } from '#/db/pullState'
import { goalOwner } from '#/features/planned/data/owners'
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

beforeEach(async () => {
  runPlanner.mockReset().mockResolvedValue(undefined)
  resetPullState()
  useSessionStore.getState().clear()
  await db.syncState.clear()
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

  it('runs without this launch’s pull when the device pulled the inputs before', async () => {
    signIn()
    await recordPlannerInputsPulled()
    resetPullState()

    renderHook(() => usePlannedRunner())

    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(1))
  })

  it('holds the auto pass until this launch’s pull while online — another device may have paid', async () => {
    signIn()
    await recordPlannerInputsPulled()
    resetPullState()

    renderHook(() => usePlannedRunner())
    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(1))
    expect(runPlanner.mock.calls[0][2]).toEqual({ auto: false })

    act(() => notePlannerInputsPulled())
    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(2))
    expect(runPlanner.mock.calls[1][2]).toEqual({ auto: true })
  })

  it('runs the auto pass offline on what the device already has', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    signIn()
    await recordPlannerInputsPulled()
    resetPullState()

    renderHook(() => usePlannedRunner())
    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(1))
    expect(runPlanner.mock.calls[0][2]).toEqual({ auto: true })
    online.mockRestore()
  })

  it('remembers a pull per user, on this device', async () => {
    signIn()
    expect(await plannerInputsOnDevice('u1')).toBe(false)

    await recordPlannerInputsPulled()

    expect(await plannerInputsOnDevice('u1')).toBe(true)
    expect(await plannerInputsOnDevice('u2')).toBe(false)
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

    act(() => requestPlanRecalc(goalOwner('g1')))

    await waitFor(() => expect(runPlanner).toHaveBeenCalledTimes(settled + 1))
  })
})
