import {
  Bell,
  Coins,
  LayoutGrid,
  Mail,
  Shield,
  SlidersHorizontal,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SectionKey =
  | 'account'
  | 'prefs'
  | 'currency'
  | 'categories'
  | 'email'
  | 'notif'
  | 'data'

export const SECTIONS: { key: SectionKey; label: string; icon: LucideIcon }[] =
  [
    { key: 'account', label: 'Account', icon: User },
    { key: 'prefs', label: 'Preferences', icon: SlidersHorizontal },
    { key: 'currency', label: 'Currencies & rates', icon: Coins },
    { key: 'categories', label: 'Categories', icon: LayoutGrid },
    { key: 'email', label: 'Email sync', icon: Mail },
    { key: 'notif', label: 'Notifications', icon: Bell },
    { key: 'data', label: 'Data & privacy', icon: Shield },
  ]

const BASE =
  'flex shrink-0 items-center gap-[10px] whitespace-nowrap rounded-full border px-[13px] py-[9px] text-[13px] font-semibold md:w-full md:rounded-[11px] md:border-0 md:px-3 md:py-2.5 md:text-[14px]'

type Props = {
  active: SectionKey
  onSelect: (key: SectionKey) => void
}

export function SettingsRail({ active, onSelect }: Props) {
  return (
    <div className="-mx-[14px] flex flex-row gap-2 overflow-x-auto px-[14px] pb-1 md:mx-0 md:flex-col md:gap-[3px] md:overflow-visible md:px-0 md:pb-0 md:sticky md:top-2">
      <div className="mx-1.5 mb-3 hidden text-[22px] font-extrabold tracking-[-0.02em] md:block">
        Settings
      </div>
      {SECTIONS.map((s) => {
        const isActive = s.key === active
        const Icon = s.icon
        const cls = `${BASE} ${
          isActive
            ? 'border-transparent bg-fp-accent-soft text-fp-accent-ink md:font-bold'
            : 'border-fp-border bg-fp-surface text-fp-text-2 md:border-0 md:bg-transparent md:hover:bg-fp-surface-2'
        }`
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            className={cls}
          >
            <Icon size={17} strokeWidth={1.8} className="shrink-0" />
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
