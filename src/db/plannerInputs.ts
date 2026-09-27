import { useSessionStore } from '#/stores/session'
import { db } from './db'
import { notePlannerInputsPulled } from './pullState'

// A `syncState` row, so wiping the user's data wipes it too. No delta stream uses this name.
const markerKey = (userId: string): string => `${userId}:plannerInputs`

/**
 * Notes a pull that brought the planner's inputs home: for this app load, the counter the
 * runner re-runs on; for this device, a marker that outlives the tab, so a launch without a
 * network still knows the local rows came from the server.
 */
export async function recordPlannerInputsPulled(): Promise<void> {
  notePlannerInputsPulled()
  const userId = useSessionStore.getState().user?.id
  if (!userId) return
  const at = new Date().toISOString()
  await db.syncState.put({ id: markerKey(userId), since: at, updatedAt: at })
}

/** Whether this device has pulled the user's planner inputs since its data was last wiped. */
export async function plannerInputsOnDevice(userId: string): Promise<boolean> {
  return (await db.syncState.get(markerKey(userId))) !== undefined
}
