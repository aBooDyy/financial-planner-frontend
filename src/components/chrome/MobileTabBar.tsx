import { Link } from '@tanstack/react-router'
import { PieChart, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NAV_SECTIONS } from './sections'
import type { AppSection } from './sections'

const ICONS: Record<AppSection, LucideIcon> = {
  balances: Wallet,
  goals: Target,
  budget: PieChart,
}

type Props = {
  active?: AppSection
}

export function MobileTabBar({ active }: Props) {
  return (
    <div className="flex flex-none border-t border-fp-border bg-fp-surface/70 backdrop-blur-[14px] md:hidden">
      {NAV_SECTIONS.map((section) => {
        const Icon = ICONS[section.key]
        const isActive = section.key === active
        const cls = `flex flex-1 flex-col items-center gap-[3px] border-none bg-transparent py-[9px] text-[11px] font-semibold ${
          isActive ? 'text-fp-accent' : 'text-fp-text-3'
        }`
        const content = (
          <>
            <Icon size={22} strokeWidth={1.7} />
            <span>{section.label}</span>
          </>
        )
        if (section.to && !isActive) {
          return (
            <Link key={section.key} to={section.to} className={cls}>
              {content}
            </Link>
          )
        }
        return (
          <button
            key={section.key}
            type="button"
            disabled={!section.to}
            className={`${cls}${section.to ? '' : ' opacity-60'}`}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
