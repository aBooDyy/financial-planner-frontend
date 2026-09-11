import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DATE_FORMAT } from '#/lib/date'
import type { DateFormat } from '#/lib/date'

/**
 * Device-local user preferences that aren't (yet) domain data on the server: display and
 * notification choices surfaced in Settings. Persisted to localStorage so they stick across
 * reloads. Theme and base currency are NOT here — they have their own stores / synced rows.
 */
export type NumberFormat = '1,234.56' | '1.234,56'
export type WeekStart = 'Sunday' | 'Monday'

export type NotificationPrefs = {
  bills: boolean
  budget: boolean
  low: boolean
  weekly: boolean
  goals: boolean
}

type PreferencesState = {
  numberFormat: NumberFormat
  dateFormat: DateFormat
  weekStart: WeekStart
  defaultAccountId: string | null
  hideEmptyWallets: boolean
  autoUpdateRates: boolean
  autoBackup: boolean
  notifications: NotificationPrefs
  setNumberFormat: (v: NumberFormat) => void
  setDateFormat: (v: DateFormat) => void
  setWeekStart: (v: WeekStart) => void
  setDefaultAccountId: (v: string | null) => void
  setHideEmptyWallets: (v: boolean) => void
  setAutoUpdateRates: (v: boolean) => void
  setAutoBackup: (v: boolean) => void
  toggleNotification: (key: keyof NotificationPrefs) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      numberFormat: '1,234.56',
      dateFormat: DEFAULT_DATE_FORMAT,
      weekStart: 'Sunday',
      defaultAccountId: null,
      hideEmptyWallets: false,
      autoUpdateRates: true,
      autoBackup: true,
      notifications: {
        bills: true,
        budget: true,
        low: false,
        weekly: true,
        goals: true,
      },
      setNumberFormat: (numberFormat) => set({ numberFormat }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setWeekStart: (weekStart) => set({ weekStart }),
      setDefaultAccountId: (defaultAccountId) => set({ defaultAccountId }),
      setHideEmptyWallets: (hideEmptyWallets) => set({ hideEmptyWallets }),
      setAutoUpdateRates: (autoUpdateRates) => set({ autoUpdateRates }),
      setAutoBackup: (autoBackup) => set({ autoBackup }),
      toggleNotification: (key) =>
        set((s) => ({
          notifications: { ...s.notifications, [key]: !s.notifications[key] },
        })),
    }),
    { name: 'fp-preferences' },
  ),
)
