import type { CurrencyCode } from '#/lib/currency'
import type {
  GoalFrequency,
  GoalKind,
  IntervalUnit,
} from '#/features/goals/api/types'

export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'SAR'

// Color tags a goal / income stream can wear (mirrors the Means design palette).
export const GOAL_COLORS = [
  '#1F9D6B',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
  '#14B8A6',
  '#64748B',
] as const

/** How a due date steps: `every` days, weeks or calendar months at a time. */
export type Cadence = { unit: IntervalUnit; every: number }

export type FreqMeta = {
  label: string
  perYear: number
  short: string
  every: string
  ahead: number
  cadence: Cadence
}

// Occurrences per year (to normalize to a monthly figure), display strings, how far ahead
// the default next-due lands, and how a due date steps. Mirrors the design's FREQ table.
export const FREQUENCIES: Record<GoalFrequency, FreqMeta> = {
  weekly: {
    label: 'Weekly',
    perYear: 52,
    short: '/wk',
    every: 'every week',
    ahead: 1,
    cadence: { unit: 'week', every: 1 },
  },
  monthly: {
    label: 'Monthly',
    perYear: 12,
    short: '/mo',
    every: 'every month',
    ahead: 1,
    cadence: { unit: 'month', every: 1 },
  },
  quarterly: {
    label: 'Quarterly',
    perYear: 4,
    short: '/qtr',
    every: 'every quarter',
    ahead: 3,
    cadence: { unit: 'month', every: 3 },
  },
  semi: {
    label: 'Semi-annual',
    perYear: 2,
    short: '/6mo',
    every: 'twice a year',
    ahead: 6,
    cadence: { unit: 'month', every: 6 },
  },
  annual: {
    label: 'Annual',
    perYear: 1,
    short: '/yr',
    every: 'every year',
    ahead: 12,
    cadence: { unit: 'month', every: 12 },
  },
}

export const FREQUENCY_OPTIONS = Object.keys(FREQUENCIES) as GoalFrequency[]

// A custom "every N units" frequency: N from 1 to this (the server's bound), starting at 28 days.
export const CUSTOM_INTERVAL_MAX = 365
export const DEFAULT_CUSTOM_INTERVAL = 28
export const DEFAULT_CUSTOM_UNIT: IntervalUnit = 'day'

type KindMeta = { chip: string; title: string; desc: string }

export const KINDS: Record<GoalKind, KindMeta> = {
  onetime: {
    chip: 'Goal',
    title: 'One-time goal',
    desc: 'Save toward a target by a date',
  },
  recurring: {
    chip: 'Obligation',
    title: 'Obligation',
    desc: 'A recurring bill you must pay',
  },
  openended: {
    chip: 'Fund',
    title: 'Open-ended',
    desc: 'Steady saving, no deadline',
  },
  sinking: {
    chip: 'Sinking',
    title: 'Sinking fund',
    desc: 'Smooth a recurring future cost',
  },
}

export const KIND_OPTIONS = Object.keys(KINDS) as GoalKind[]

// Goals that come due on a frequency and carry a `nextDue` date.
export const RECURRING_KINDS: GoalKind[] = ['recurring', 'sinking']

export type FundingStatus = 'green' | 'amber' | 'red'

// Status colors are fixed (independent of theme) so a funded goal always reads green, etc.
export const STATUS_COLORS: Record<
  FundingStatus,
  { main: string; soft: string }
> = {
  green: { main: '#1F9D6B', soft: 'rgba(31,157,107,0.13)' },
  amber: { main: '#D9882B', soft: 'rgba(217,136,43,0.15)' },
  red: { main: '#E5484D', soft: 'rgba(229,72,77,0.13)' },
}
