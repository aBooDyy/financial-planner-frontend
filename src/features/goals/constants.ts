import type { CurrencyCode } from '#/lib/currency'
import type { GoalFrequency, GoalKind } from '#/features/goals/api/types'

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

type FreqMeta = {
  label: string
  perYear: number
  short: string
  every: string
  ahead: number
}

// Occurrences per year (to normalize to a monthly figure), display strings, and how far ahead
// the default next-due lands. Mirrors the design's FREQ table.
export const FREQUENCIES: Record<GoalFrequency, FreqMeta> = {
  weekly: {
    label: 'Weekly',
    perYear: 52,
    short: '/wk',
    every: 'every week',
    ahead: 1,
  },
  monthly: {
    label: 'Monthly',
    perYear: 12,
    short: '/mo',
    every: 'every month',
    ahead: 1,
  },
  quarterly: {
    label: 'Quarterly',
    perYear: 4,
    short: '/qtr',
    every: 'every quarter',
    ahead: 3,
  },
  semi: {
    label: 'Semi-annual',
    perYear: 2,
    short: '/6mo',
    every: 'twice a year',
    ahead: 6,
  },
  annual: {
    label: 'Annual',
    perYear: 1,
    short: '/yr',
    every: 'every year',
    ahead: 12,
  },
}

export const FREQUENCY_OPTIONS = Object.keys(FREQUENCIES) as GoalFrequency[]

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
