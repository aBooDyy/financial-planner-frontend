import { STATUS_COLORS } from '#/features/goals/constants'
import { GOALS_SECTIONS } from './sections'
import type { GoalsSection } from './sections'

type Props = {
  active: GoalsSection
  alerts: Partial<Record<GoalsSection, boolean>>
  onSelect: (section: GoalsSection) => void
}

// Mobile section switch. It sits under the top bar so the app-wide bottom tab bar keeps its
// place; a dot marks a section holding something that isn't on track.
export function SectionTabs({ active, alerts, onSelect }: Props) {
  return (
    <div className="flex flex-none border-b border-fp-border bg-fp-surface/70 backdrop-blur-[14px] md:hidden">
      {GOALS_SECTIONS.map((section) => {
        const Icon = section.icon
        const isActive = section.key === active
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onSelect(section.key)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-[3px] py-2 text-[10.5px] ${
              isActive
                ? 'font-bold text-fp-accent'
                : 'font-semibold text-fp-text-3'
            }`}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{section.label}</span>
            {alerts[section.key] ? (
              <span
                className="absolute top-[6px] end-[calc(50%-16px)] h-[6px] w-[6px] rounded-full"
                style={{ background: STATUS_COLORS.amber.main }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
