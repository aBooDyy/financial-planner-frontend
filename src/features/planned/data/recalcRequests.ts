/**
 * Goals and bills whose plan should be rewritten on the planner's next run: a plan-changing
 * edit, money added off plan, a reopen or a resume. The owning slices file a request here and
 * the planner picks it up, so the change is written through to the stored plan without those
 * slices knowing how. Session-scoped: a request is served within the planner's debounce, and a
 * reload before that leaves the old plan standing until the user recalculates, which is the
 * safe side to fail on.
 */
import { ownerKey } from './owners'
import type { PlanOwner } from './owners'

type Listener = () => void

export type PlanRecalcRequest = {
  owner: PlanOwner
  /** A quiet rewrite offers no "Plan updated · Undo" (nothing the user typed changed). */
  quiet: boolean
}

const requested = new Map<string, PlanRecalcRequest>()
const listeners = new Set<Listener>()

export function requestPlanRecalc(
  owner: PlanOwner,
  options: { quiet?: boolean } = {},
): void {
  const key = ownerKey(owner)
  const quiet = (options.quiet ?? false) && (requested.get(key)?.quiet ?? true)
  requested.set(key, { owner, quiet })
  for (const listener of listeners) listener()
}

/** Hand over every pending request and forget them. */
export function takePlanRecalcRequests(): PlanRecalcRequest[] {
  const out = [...requested.values()]
  requested.clear()
  return out
}

export function onPlanRecalcRequested(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
