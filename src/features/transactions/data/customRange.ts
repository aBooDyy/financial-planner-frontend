import { parseISODate } from '#/lib/date'
import { addDays, ymd } from './planning'

/** A custom span as the range dialog edits it: wire ISO dates, `''` while unpicked. */
export type IsoSpan = { start: string; end: string }

export type CustomRangePreset = { key: string; label: string; span: IsoSpan }

const lastDays = (days: number, today: Date): IsoSpan => ({
  start: ymd(addDays(today, 1 - days)),
  end: ymd(today),
})

/** One-tap spans that fill the range dialog's fields, all ending today. */
export const customRangePresets = (today: Date): CustomRangePreset[] => [
  { key: '7d', label: 'Last 7 days', span: lastDays(7, today) },
  { key: '30d', label: 'Last 30 days', span: lastDays(30, today) },
  { key: '90d', label: 'Last 90 days', span: lastDays(90, today) },
  {
    key: 'ytd',
    label: 'Year to date',
    span: { start: ymd(new Date(today.getFullYear(), 0, 1)), end: ymd(today) },
  },
]

/** What stops a span from being shown, or null when it can be. */
export function customRangeProblem(span: IsoSpan): string | null {
  if (!parseISODate(span.start) || !parseISODate(span.end))
    return 'Pick both dates'
  if (span.start > span.end) return 'The start must be on or before the end'
  return null
}
