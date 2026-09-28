import { Link } from '@tanstack/react-router'
import { MoonStar, Sun } from 'lucide-react'
import { useThemeStore } from '#/stores/theme'
import { SearchTrigger } from '#/features/search/components/SearchTrigger'
import type { User } from '#/features/auth/api/types'
import { AccountMenu } from './AccountMenu'
import { BrandMark } from './BrandMark'
import { OfflineIndicator } from './OfflineIndicator'
import { PrivacyToggle } from './PrivacyToggle'
import { SyncIndicator } from './SyncIndicator'
import { NAV_SECTIONS } from './sections'
import type { AppSection } from './sections'

type Props = {
  user: User
  active?: AppSection
  onSignOut: () => void
}

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '·'

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const ACTIVE =
  'rounded-[10px] px-[14px] py-2 text-[14px] bg-fp-accent-soft font-semibold text-fp-accent-ink'
const LINK =
  'rounded-[10px] px-[14px] py-2 text-[14px] font-medium text-fp-text-2 hover:bg-fp-surface-2'
const DISABLED =
  'rounded-[10px] px-[14px] py-2 text-[14px] font-medium text-fp-text-3 opacity-60 cursor-not-allowed'

export function TopNav({ user, active, onSignOut }: Props) {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)
  const isDark =
    preference === 'dark' || (preference === 'system' && prefersDark())

  return (
    // iOS softens a strip just past the status bar in home-screen apps; the extra
    // padding keeps the bar's controls below it.
    <div className="flex-none border-b border-fp-border bg-fp-surface/70 pt-[env(safe-area-inset-top)] backdrop-blur-[14px] max-md:standalone:pt-[calc(env(safe-area-inset-top)+12px)]">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-[10px] px-4 md:h-16 md:gap-[18px] md:px-6">
        <BrandMark />

        <nav className="ms-4 hidden items-center gap-1 md:flex">
          {NAV_SECTIONS.map((section) => {
            if (section.key === active) {
              return (
                <span key={section.key} className={ACTIVE}>
                  {section.label}
                </span>
              )
            }
            if (section.to) {
              return (
                <Link key={section.key} to={section.to} className={LINK}>
                  {section.label}
                </Link>
              )
            }
            return (
              <button
                key={section.key}
                type="button"
                disabled
                className={DISABLED}
              >
                {section.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-[9px]">
          <SearchTrigger />
          <SyncIndicator />
          <OfflineIndicator />

          <PrivacyToggle />

          <button
            type="button"
            onClick={() => setPreference(isDark ? 'light' : 'dark')}
            title="Toggle theme"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-fp-border bg-fp-surface text-fp-text-2 hover:text-fp-text"
          >
            {isDark ? <Sun size={18} /> : <MoonStar size={18} />}
          </button>

          <AccountMenu
            user={user}
            initials={initialsOf(user.name)}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </div>
  )
}
