import { Link } from '@tanstack/react-router'
import { PieChart, Plus, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQuickAddStore } from '#/features/transactions/stores/quickAdd'
import { NAV_SECTIONS } from './sections'
import type { AppSection, NavSection } from './sections'

const ICONS: Record<AppSection, LucideIcon> = {
  wallets: Wallet,
  goals: Target,
  budget: PieChart,
}

type Props = {
  active?: AppSection
}

// The add button sits dead centre, so each half of the bar takes an equal share of width.
const SPLIT = Math.ceil(NAV_SECTIONS.length / 2)

export function MobileTabBar({ active }: Props) {
  return (
    // In a home-screen app the bar sits on the screen's rounded bottom corners, so it
    // clears them by more than the home-indicator inset alone.
    <div className="flex flex-none items-stretch border-t border-fp-border bg-fp-surface/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-[14px] standalone:pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
      <TabGroup sections={NAV_SECTIONS.slice(0, SPLIT)} active={active} />
      <AddTab />
      <TabGroup sections={NAV_SECTIONS.slice(SPLIT)} active={active} />
    </div>
  )
}

function TabGroup({
  sections,
  active,
}: {
  sections: NavSection[]
  active?: AppSection
}) {
  return (
    <div className="flex flex-1">
      {sections.map((section) => (
        <Tab
          key={section.key}
          section={section}
          isActive={section.key === active}
        />
      ))}
    </div>
  )
}

function Tab({
  section,
  isActive,
}: {
  section: NavSection
  isActive: boolean
}) {
  const Icon = ICONS[section.key]
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
      <Link to={section.to} className={cls}>
        {content}
      </Link>
    )
  }
  return (
    <button
      type="button"
      disabled={!section.to}
      className={`${cls}${section.to ? '' : ' opacity-60'}`}
    >
      {content}
    </button>
  )
}

function AddTab() {
  const show = useQuickAddStore((s) => s.show)
  return (
    <div className="flex w-[72px] flex-none items-center justify-center">
      <button
        type="button"
        onClick={show}
        title="Add transaction"
        aria-label="Add transaction"
        className="flex h-[52px] w-[52px] -translate-y-4 items-center justify-center rounded-full border-4 border-fp-bg bg-fp-accent text-white shadow-[0_4px_18px_-6px_var(--fp-accent)] transition-transform active:scale-95"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>
    </div>
  )
}
