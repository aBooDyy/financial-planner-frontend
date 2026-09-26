import type { SampleVerdict } from '#/features/email-sync/api/types'

/** How many of the tested emails each rule handles (first match wins), by position. */
export function handledCounts(
  verdicts: SampleVerdict[],
  ruleCount: number,
): number[] {
  const counts = Array.from({ length: ruleCount }, () => 0)
  for (const v of verdicts) {
    if (v.matchedIndex !== null && v.matchedIndex < ruleCount)
      counts[v.matchedIndex] += 1
  }
  return counts
}

/** What the rule being edited catches among the tested emails. */
export type FocusMatches = {
  total: number
  /** Emails its filter lets through. */
  matched: SampleVerdict[]
  /** Of those, the ones an earlier rule takes first. */
  takenEarlier: number
}

export function focusMatches(
  verdicts: SampleVerdict[],
  focusIndex: number,
): FocusMatches {
  const matched = verdicts.filter((v) => v.focus?.matched)
  return {
    total: verdicts.length,
    matched,
    takenEarlier: matched.filter(
      (v) => v.matchedIndex !== null && v.matchedIndex < focusIndex,
    ).length,
  }
}

/** Emails no rule handles — mail a rule could still be written for. */
export const unhandled = (verdicts: SampleVerdict[]): number =>
  verdicts.filter((v) => v.matchedIndex === null).length
