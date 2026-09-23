import { STATUS_COLORS } from '#/features/goals/constants'
import { GOALS_SECTIONS } from './sections'
import type { GoalsSection } from './sections'

type Props = {
  active: GoalsSection
  counts: Partial<Record<GoalsSection, number>>
  alerts: Partial<Record<GoalsSection, boolean>>
  onSelect: (section: GoalsSection) => void
}

// Desktop section switch: a card at the top of the content column, so the tabs sit on the same
// scale as the cards below them.
export function SectionTabCard({ active, counts, alerts, onSelect }: Props) {
  return (
    <div className="mb-[14px] hidden items-stretch gap-[22px] overflow-x-auto rounded-[14px] border border-fp-border bg-fp-surface px-4 shadow-fp md:flex">
      {GOALS_SECTIONS.map((section) => {
        const isActive = section.key === active
        const count = counts[section.key]
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-12 flex-none items-center gap-[6px] text-[14px] whitespace-nowrap ${
              isActive
                ? 'font-bold text-fp-text shadow-[inset_0_-2px_0_var(--fp-accent)]'
                : 'font-medium text-fp-text-3 hover:text-fp-text-2'
            }`}
          >
            <span>{section.label}</span>
            {count !== undefined ? (
              <span className="rounded-full bg-fp-surface-2 px-[7px] py-px text-[11px] font-bold text-fp-text-2 tabular-nums">
                {count}
              </span>
            ) : null}
            {alerts[section.key] ? (
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: STATUS_COLORS.amber.main }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
