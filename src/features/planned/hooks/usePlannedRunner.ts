import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { usePullStateStore } from '#/db/pullState'
import { startOfToday } from '#/features/goals/data/planning'
import { isoOf } from '#/features/planned/data/dates'
import { onPlanRecalcRequested } from '#/features/planned/data/recalcRequests'
import { runPlanner } from '#/features/planned/data/runner'
import { useSessionStore } from '#/stores/session'

const DEBOUNCE_MS = 500
const DAY_CHECK_MS = 60_000

type Stampable = { id: string; version: string; updatedAt: string }
const stamp = (rows: ReadonlyArray<Stampable>): string =>
  rows.map((r) => `${r.id}:${r.version}:${r.updatedAt}`).join('|')

/**
 * Keeps planned rows in line with the goals, income streams and schedules they come from,
 * for the whole session — mounted once, by the root layout, like sync.
 *
 * It waits for the first pull of the planner's inputs: on a fresh device, generating before
 * the server's rows arrive would only re-create them (harmless with deterministic ids, but
 * noise). After that it runs, debounced, whenever an origin changes, a pull lands, a plan
 * rewrite is requested, or the day turns.
 */
export function usePlannedRunner(): void {
  const authenticated = useSessionStore((s) => s.status === 'authenticated')
  const userId = useSessionStore((s) => s.user?.id ?? null)
  const pulled = usePullStateStore((s) => s.plannerInputsPulled)
  const origins = useLiveQuery(async () => {
    const [goals, income, recurrings] = await Promise.all([
      db.goals.toArray(),
      db.incomeStreams.toArray(),
      db.recurrings.toArray(),
    ])
    return [stamp(goals), stamp(income), stamp(recurrings)].join('#')
  })
  const [day, setDay] = useState(() => isoOf(startOfToday()))
  const [requests, setRequests] = useState(0)

  useEffect(() => onPlanRecalcRequested(() => setRequests((n) => n + 1)), [])

  useEffect(() => {
    const check = () => setDay(isoOf(startOfToday()))
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, DAY_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!authenticated || !userId || pulled === 0) return
    const timer = setTimeout(() => {
      void runPlanner(userId, startOfToday()).catch(() => undefined)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [authenticated, userId, pulled, origins, day, requests])
}
