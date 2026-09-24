/**
 * Goals whose plan was just changed by the user (a plan-changing edit). The goals slice files
 * a request here and the planner picks it up, so the edit is written through to the stored
 * plan without the goals slice knowing how. Session-scoped: a request is served within the
 * planner's debounce, and a reload before that leaves the old plan standing until the user
 * recalculates, which is the safe side to fail on.
 */

type Listener = () => void

const requested = new Set<string>()
const listeners = new Set<Listener>()

export function requestPlanRecalc(goalId: string): void {
  requested.add(goalId)
  for (const listener of listeners) listener()
}

/** Hand over every pending request and forget them. */
export function takePlanRecalcRequests(): string[] {
  const out = [...requested]
  requested.clear()
  return out
}

export function onPlanRecalcRequested(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
