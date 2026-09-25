import { Link } from '@tanstack/react-router'
import {
  Archive,
  Bell,
  Coins,
  LayoutGrid,
  Mail,
  Shield,
  SlidersHorizontal,
  Store,
  User,
  Webhook,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Section = { to: string; label: string; icon: LucideIcon }

export const SECTIONS: Section[] = [
  { to: '/settings/account', label: 'Account', icon: User },
  {
    to: '/settings/preferences',
    label: 'Preferences',
    icon: SlidersHorizontal,
  },
  { to: '/settings/currencies', label: 'Currencies & rates', icon: Coins },
  { to: '/settings/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/settings/merchants', label: 'Merchants', icon: Store },
  { to: '/settings/email-sync', label: 'Email sync', icon: Mail },
  { to: '/settings/integrations', label: 'Integrations', icon: Webhook },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/archived', label: 'Archived', icon: Archive },
  { to: '/settings/data', label: 'Data & privacy', icon: Shield },
]

const BASE =
  'flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full border px-[13px] py-[9px] text-[13px] font-semibold md:w-full md:rounded-[11px] md:border-0 md:px-3 md:py-2.5 md:text-[14px]'
const ACTIVE =
  'border-transparent bg-fp-accent-soft text-fp-accent-ink md:font-bold'
const IDLE =
  'border-fp-border bg-fp-surface text-fp-text-2 md:border-0 md:bg-transparent md:hover:bg-fp-surface-2'

export function SettingsRail() {
  return (
    <div className="-mx-[14px] flex flex-row gap-2 overflow-x-auto px-[14px] pb-1 md:mx-0 md:flex-col md:gap-[3px] md:overflow-visible md:px-0 md:pb-0 md:sticky md:top-2">
      <div className="mx-1.5 mb-3 hidden text-[22px] font-extrabold tracking-[-0.02em] md:block">
        Settings
      </div>
      {SECTIONS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={BASE}
          activeProps={{ className: `${BASE} ${ACTIVE}` }}
          inactiveProps={{ className: `${BASE} ${IDLE}` }}
        >
          <Icon size={17} strokeWidth={1.8} className="shrink-0" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  )
}
