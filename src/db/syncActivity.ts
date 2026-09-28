import { create } from 'zustand'

type SyncActivity = {
  /** Push drains and pulls currently talking to the server. */
  running: number
  /** When a push drain or pull last finished without throwing; null until one has. */
  lastSyncedAt: number | null
  /** Whether the latest finished drain or pull threw, e.g. the server could not be reached. */
  lastPassFailed: boolean
}

export const useSyncActivityStore = create<SyncActivity>(() => ({
  running: 0,
  lastSyncedAt: null,
  lastPassFailed: false,
}))

const shift = (by: number): void =>
  useSyncActivityStore.setState((s) => ({ running: s.running + by }))

/** Count `work` as sync in flight for exactly as long as it runs, and record how it ended. */
export async function trackSync<T>(work: () => Promise<T>): Promise<T> {
  shift(1)
  try {
    const result = await work()
    useSyncActivityStore.setState({
      lastSyncedAt: Date.now(),
      lastPassFailed: false,
    })
    return result
  } catch (e) {
    useSyncActivityStore.setState({ lastPassFailed: true })
    throw e
  } finally {
    shift(-1)
  }
}

export const useSyncing = (): boolean =>
  useSyncActivityStore((s) => s.running > 0)
