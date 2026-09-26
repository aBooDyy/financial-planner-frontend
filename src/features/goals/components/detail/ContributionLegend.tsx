import type { ContributionMark as Mark } from '#/features/goals/data/goalDetail'
import { ContributionMark } from './ContributionMark'

const ENTRIES: ReadonlyArray<{ mark: Mark; label: string }> = [
  { mark: 'confirmed', label: 'confirmed' },
  { mark: 'due', label: 'due' },
  { mark: 'future', label: 'planned' },
]

/** What the contribution marks mean. */
export function ContributionLegend({ color }: { color: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-[11px] text-fp-text-3">
      {ENTRIES.map((e) => (
        <span key={e.mark} className="inline-flex items-center gap-[5px]">
          <ContributionMark mark={e.mark} color={color} size={7} />
          {e.label}
        </span>
      ))}
    </span>
  )
}
