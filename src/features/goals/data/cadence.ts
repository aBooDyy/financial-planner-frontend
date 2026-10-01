/**
 * A repeat rule as one shape: a preset frequency or a custom "every N days / weeks /
 * months". Every due-date step and every cadence string for a bill or an income stream reads
 * from here.
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
import type { Cadence, FreqMeta } from '#/features/goals/constants'

export type Repeat = {
  frequency: ObligationFrequency | null
  customInterval: number | null
  customUnit: IntervalUnit | null
}

/** A repeat as an editor holds it: the preset chip, or the custom chip and its interval as typed. */
export type RepeatDraft = {
  frequency: GoalFrequency
  customRepeat: boolean
  customInterval: string
  customUnit: IntervalUnit
}

const UNIT_WORDS: Record<
  IntervalUnit,
  { one: string; many: string; short: string }
> = {
  day: { one: 'day', many: 'days', short: 'd' },
  week: { one: 'week', many: 'weeks', short: 'wk' },
  month: { one: 'month', many: 'months', short: 'mo' },
}

// Matches the presets: weekly is 52 a year, monthly 12.
const PER_YEAR: Record<IntervalUnit, number> = { day: 365, week: 52, month: 12 }

/** "every 28 days", "every 2 months", "every week". */
export const intervalPhrase = (every: number, unit: IntervalUnit): string =>
  every === 1
    ? `every ${UNIT_WORDS[unit].one}`
    : `every ${every} ${UNIT_WORDS[unit].many}`

export const isValidInterval = (every: number): boolean =>
  Number.isInteger(every) && every >= 1 && every <= CUSTOM_INTERVAL_MAX

export function customFrequencyMeta(
  every: number,
  unit: IntervalUnit,
): FreqMeta {
  const perYear = PER_YEAR[unit] / every
  const phrase = intervalPhrase(every, unit)
  const { short } = UNIT_WORDS[unit]
  return {
    label: phrase.charAt(0).toUpperCase() + phrase.slice(1),
    perYear,
    short: every === 1 ? `/${short}` : `/${every}${short}`,
    every: phrase,
    ahead: Math.max(1, Math.round(12 / perYear)),
    cadence: { unit, every },
  }
}

/** The repeat's frequency metadata; `fallback` stands in for a missing frequency. */
export function frequencyMetaOf(
  g: Repeat,
  fallback: GoalFrequency = 'annual',
): FreqMeta {
  if (g.frequency !== 'custom') return FREQUENCIES[g.frequency ?? fallback]
  return g.customInterval && g.customUnit
    ? customFrequencyMeta(g.customInterval, g.customUnit)
    : FREQUENCIES[fallback]
}

/** A stored repeat as an editor holds it; `fallback` stands in for a missing frequency. */
export function repeatDraftOf(r: Repeat, fallback: GoalFrequency): RepeatDraft {
  if (r.frequency !== 'custom')
    return {
      frequency: r.frequency ?? fallback,
      customRepeat: false,
      customInterval: String(DEFAULT_CUSTOM_INTERVAL),
      customUnit: DEFAULT_CUSTOM_UNIT,
    }
  return {
    frequency: 'monthly',
    customRepeat: true,
    customInterval: String(r.customInterval ?? DEFAULT_CUSTOM_INTERVAL),
    customUnit: r.customUnit ?? DEFAULT_CUSTOM_UNIT,
  }
}

/** The repeat a draft saves: its preset, or its custom interval. */
export const repeatOfDraft = (
  draft: RepeatDraft,
): {
  frequency: ObligationFrequency
  customInterval: number | null
  customUnit: IntervalUnit | null
} =>
  draft.customRepeat
    ? {
        frequency: 'custom',
        customInterval: Number(draft.customInterval),
        customUnit: draft.customUnit,
      }
    : { frequency: draft.frequency, customInterval: null, customUnit: null }

/** Why a draft's repeat can't be saved yet, or null when it can. */
export const repeatBlock = (
  draft: Pick<RepeatDraft, 'customRepeat' | 'customInterval'>,
): string | null =>
  draft.customRepeat && !isValidInterval(Number(draft.customInterval))
    ? `Repeat every 1 to ${CUSTOM_INTERVAL_MAX} days, weeks or months`
    : null

/** Whole months between dues, at least one — the planner's month-granular view of a cycle. */
export const cycleMonthsOf = (meta: FreqMeta): number =>
  Math.max(1, Math.round(12 / meta.perYear))

const DAY_MS = 86_400_000

const stepDays = ({ unit, every }: Cadence): number =>
  unit === 'week' ? 7 * every : every

/**
 * The due `n` cycles from `anchor` (negative steps back). Always measured from the anchor, so
 * month steps keep its day instead of drifting.
 */
export function stepDue(anchor: Date, cadence: Cadence, n: number): Date {
  if (cadence.unit === 'month')
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth() + n * cadence.every,
      anchor.getDate(),
    )
  return new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + n * stepDays(cadence),
  )
}

/** Roughly how many whole cycles lie between `anchor` and `date`; may be one off either way. */
export function approxCyclesBetween(
  anchor: Date,
  date: Date,
  cadence: Cadence,
): number {
  if (cadence.unit === 'month') {
    const months =
      (date.getFullYear() - anchor.getFullYear()) * 12 +
      (date.getMonth() - anchor.getMonth())
    return Math.floor(months / cadence.every)
  }
  return Math.floor(
    (date.getTime() - anchor.getTime()) / (stepDays(cadence) * DAY_MS),
  )
}
