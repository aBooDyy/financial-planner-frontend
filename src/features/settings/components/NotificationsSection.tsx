import { usePreferencesStore } from '#/stores/preferences'
import type { NotificationPrefs } from '#/stores/preferences'
import { SectionHeader } from './SectionHeader'
import { SettingRow } from './SettingRow'
import { Toggle } from './Toggle'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

const ROWS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  {
    key: 'bills',
    label: 'Bill reminders',
    desc: 'Heads-up before a bill is due.',
  },
  {
    key: 'budget',
    label: 'Budget alerts',
    desc: 'When a category passes 80% of its cap.',
  },
  {
    key: 'low',
    label: 'Low balance warnings',
    desc: 'When a wallet drops below your threshold.',
  },
  {
    key: 'weekly',
    label: 'Weekly summary',
    desc: 'A Sunday email recapping the week.',
  },
  {
    key: 'goals',
    label: 'Goal milestones',
    desc: 'When a savings goal hits a milestone.',
  },
]

export function NotificationsSection() {
  const notifications = usePreferencesStore((s) => s.notifications)
  const toggle = usePreferencesStore((s) => s.toggleNotification)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Notifications"
        subtitle="What Means tells you about, and when."
      />
      <div className={CARD}>
        {ROWS.map((row, i) => (
          <SettingRow
            key={row.key}
            label={row.label}
            desc={row.desc}
            last={i === ROWS.length - 1}
          >
            <Toggle
              on={notifications[row.key]}
              onChange={() => toggle(row.key)}
              label={row.label}
            />
          </SettingRow>
        ))}
      </div>
    </div>
  )
}
