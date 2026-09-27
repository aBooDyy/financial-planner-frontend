import { create } from 'zustand'

type SyncActivity = {
  /** Push drains and pulls currently talking to the server. */
  running: number
}

export const useSyncActivityStore = create<SyncActivity>(() => ({
  running: 0,
}))

const shift = (by: number): void =>
  useSyncActivityStore.setState((s) => ({ running: s.running + by }))

/** Count `work` as sync in flight for exactly as long as it runs. */
export async function trackSync<T>(work: () => Promise<T>): Promise<T> {
  shift(1)
  try {
    return await work()
  } finally {
    shift(-1)
  }
}

export const useSyncing = (): boolean =>
  useSyncActivityStore((s) => s.running > 0)
