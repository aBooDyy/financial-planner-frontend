import { liveQuery } from 'dexie'
import type { Subscription } from 'dexie'

export type SharedLiveQuery<T> = {
  /** `useSyncExternalStore`'s subscribe: the first subscriber opens the read, the last closes it. */
  subscribe: (listener: () => void) => () => void
  /** The last result, `undefined` until the first one lands. */
  snapshot: () => T | undefined
}

/**
 * One Dexie live query shared by every mounted consumer, instead of one per hook. Its result
 * keeps its identity until the query answers again, so memos downstream hold.
 */
export function sharedLiveQuery<T>(
  query: () => Promise<T>,
): SharedLiveQuery<T> {
  let value: T | undefined
  let subscription: Subscription | null = null
  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1)
        subscription = liveQuery(query).subscribe({
          next: (next) => {
            value = next
            emit()
          },
          // A failed read leaves the last good value; the next change retries it.
          error: () => undefined,
        })
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        subscription?.unsubscribe()
        subscription = null
        value = undefined
      }
    },
    snapshot: () => value,
  }
}
