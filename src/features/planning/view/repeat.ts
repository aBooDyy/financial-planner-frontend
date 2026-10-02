/**
 * The repeat picks the bill and income editors share: the docs' preset names, an optional
 * "Just once" (bills), and Custom "every N days / weeks / months".
 */
import type {
  GoalFrequency,
  IntervalUnit,
  ObligationFrequency,
} from '#/features/goals/api/types'
import {
  CUSTOM_INTERVAL_MAX,
  DEFAULT_CUSTOM_INTERVAL,
  DEFAULT_CUSTOM_UNIT,
  FREQUENCIES,
} from '#/features/goals/constants'
import { frequencyMetaOf, isValidInterval } from '#/features/goals/data/cadence'

export type RepeatPick = 'once' | GoalFrequency | 'custom'

export const REPEAT_LABEL: Record<RepeatPick, string> = {
  once: 'Just once',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi: 'Semi-annual',
  annual: 'Annual',
  custom: 'Custom',
}

export type RepeatDraft = {
  pick: RepeatPick
  /** As typed; read only for `custom`. */
  every: string
  unit: IntervalUnit
}

export const DEFAULT_REPEAT: RepeatDraft = {
  pick: 'monthly',
  every: String(DEFAULT_CUSTOM_INTERVAL),
  unit: DEFAULT_CUSTOM_UNIT,
}

/** A stored repeat as the editor holds it; null frequency is "Just once". */
export function repeatDraftFrom(r: {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
}): RepeatDraft {
  if (r.frequency === null) return { ...DEFAULT_REPEAT, pick: 'once' }
  if (r.frequency !== 'custom') return { ...DEFAULT_REPEAT, pick: r.frequency }
  return {
    pick: 'custom',
    every: String(r.customInterval ?? DEFAULT_CUSTOM_INTERVAL),
    unit: r.customUnit ?? DEFAULT_CUSTOM_UNIT,
  }
}

/** What the draft saves: null frequency for "Just once". */
export function repeatOf(draft: RepeatDraft): {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
} {
  if (draft.pick === 'once')
    return { frequency: null, customInterval: null, customUnit: null }
  if (draft.pick === 'custom')
    return {
      frequency: 'custom',
      customInterval: Number(draft.every),
      customUnit: draft.unit,
    }
  return { frequency: draft.pick, customInterval: null, customUnit: null }
}

export const repeatValid = (draft: RepeatDraft): boolean =>
  draft.pick !== 'custom' || isValidInterval(Number(draft.every))

export const REPEAT_ERROR = `Repeat every 1 to ${CUSTOM_INTERVAL_MAX} days, weeks or months`

/** Times a year it comes round; 0 for "Just once". */
export function perYearOf(draft: RepeatDraft): number {
  if (draft.pick === 'once') return 0
  if (draft.pick !== 'custom') return FREQUENCIES[draft.pick].perYear
  return repeatValid(draft)
    ? frequencyMetaOf(repeatOf(draft), 'monthly').perYear
    : 0
}

/** "Monthly", "Every 28 days", "Just once" — a stored repeat as one label. */
export function repeatLabel(r: {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
}): string {
  if (r.frequency === null) return REPEAT_LABEL.once
  if (r.frequency !== 'custom') return REPEAT_LABEL[r.frequency]
  return frequencyMetaOf(r, 'monthly').label
}
