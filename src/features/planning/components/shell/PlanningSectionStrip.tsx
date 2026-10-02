import { Link } from '@tanstack/react-router'
import {
  PLANNING_SECTIONS,
  PLANNING_SECTION_META,
} from '#/features/planning/sections'
import type { PlanningSection } from '#/features/planning/sections'
import { CountBadge } from '#/features/planning/components/kit/CountBadge'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { cn } from '#/lib/utils'
import type { SectionBadge } from './sectionBadges'

type Props = {
  section: PlanningSection
  badges: Partial<Record<PlanningSection, SectionBadge>>
}

/** Mobile section switch under the top bar: five equal tabs, icon over label. */
export function PlanningSectionStrip({ section, badges }: Props) {
  // A detail panel belongs to the section it was opened from.
  const closeDetail = usePlanningUi((s) => s.closeDetail)
  return (
    <nav
      aria-label="Planning sections"
      className="flex flex-none border-b border-fp-border bg-fp-surface/70 backdrop-blur-[14px] md:hidden"
    >
      {PLANNING_SECTIONS.map((s) => {
        const { label, icon: Icon } = PLANNING_SECTION_META[s]
        const active = s === section
        const badge = badges[s]
        return (
          <Link
            key={s}
            to="/planning/$section"
            params={{ section: s }}
            aria-current={active ? 'page' : undefined}
            onClick={closeDetail}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-[3px] pt-2 pb-[7px] text-[11px] font-bold',
              active
                ? 'text-fp-accent-ink shadow-[inset_0_-2px_0_var(--fp-accent)]'
                : 'text-fp-text-3',
            )}
          >
            <Icon size={18} strokeWidth={1.9} aria-hidden />
            <span className="max-w-full truncate">{label}</span>
            {badge ? (
              <CountBadge
                count={badge.count}
                tone={badge.tone}
                label={badge.label}
                className="absolute top-[3px] start-[calc(50%+5px)] h-4 min-w-4 px-1 text-[10px]"
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
