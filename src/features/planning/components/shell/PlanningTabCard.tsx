import { Link } from '@tanstack/react-router'
import {
  PLANNING_SECTIONS,
  PLANNING_SECTION_META,
} from '#/features/planning/sections'
import type { PlanningSection } from '#/features/planning/sections'
import { CountBadge } from '#/features/planning/components/kit/CountBadge'
import { cn } from '#/lib/utils'
import type { SectionBadge } from './sectionBadges'

type Props = {
  section: PlanningSection
  badges: Partial<Record<PlanningSection, SectionBadge>>
}

/** Desktop section switch: a card at the top of the content, tabs with an accent underline. */
export function PlanningTabCard({ section, badges }: Props) {
  return (
    <nav
      aria-label="Planning sections"
      className="hidden min-w-0 items-stretch gap-[26px] overflow-x-auto rounded-[14px] border border-fp-border bg-fp-surface px-[18px] shadow-fp md:flex"
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
            className={cn(
              'flex flex-none items-center gap-[7px] pt-[14px] pb-3 text-[13.5px] font-bold whitespace-nowrap',
              active
                ? 'text-fp-text shadow-[inset_0_-2px_0_var(--fp-accent)]'
                : 'text-fp-text-3 hover:text-fp-text-2',
            )}
          >
            <Icon size={15} strokeWidth={2} aria-hidden />
            {label}
            {badge ? (
              <CountBadge
                count={badge.count}
                tone={badge.tone}
                label={badge.label}
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
