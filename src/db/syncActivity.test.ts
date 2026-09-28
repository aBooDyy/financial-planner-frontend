import { beforeEach, describe, expect, it } from 'vitest'
import { trackSync, useSyncActivityStore } from './syncActivity'

const running = () => useSyncActivityStore.getState().running

beforeEach(() =>
  useSyncActivityStore.setState({
    running: 0,
    lastSyncedAt: null,
    lastPassFailed: false,
  }),
)

describe('trackSync', () => {
  it('counts the work only while it runs', async () => {
    let finish = () => {}
    const work = trackSync(
      () => new Promise<void>((resolve) => (finish = resolve)),
    )
    expect(running()).toBe(1)

    finish()
    await work

    expect(running()).toBe(0)
  })

  it('stops counting a failed run and passes the error on', async () => {
    await expect(
      trackSync(() => Promise.reject(new Error('down'))),
    ).rejects.toThrow('down')
    expect(running()).toBe(0)
  })

  it('stays busy until every overlapping run is done', async () => {
    let finishFirst = () => {}
    const first = trackSync(
      () => new Promise<void>((resolve) => (finishFirst = resolve)),
    )
    await trackSync(() => Promise.resolve())

    expect(running()).toBe(1)
    finishFirst()
    await first
    expect(running()).toBe(0)
  })

  it('records when a run last finished cleanly', async () => {
    await trackSync(() => Promise.resolve())

    const state = useSyncActivityStore.getState()
    expect(state.lastSyncedAt).not.toBeNull()
    expect(state.lastPassFailed).toBe(false)
  })

  it('marks the latest pass failed until a later one succeeds', async () => {
    await trackSync(() => Promise.reject(new Error('down'))).catch(() => {})
    expect(useSyncActivityStore.getState().lastPassFailed).toBe(true)
    expect(useSyncActivityStore.getState().lastSyncedAt).toBeNull()

    await trackSync(() => Promise.resolve())
    expect(useSyncActivityStore.getState().lastPassFailed).toBe(false)
  })
})
