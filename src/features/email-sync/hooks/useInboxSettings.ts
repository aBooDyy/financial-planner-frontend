import { useState } from 'react'
import type { LocalEmailConnection } from '#/db/types'
import type { ConnectionSettings } from '#/features/email-sync/api/types'
import { updateConnectionSettings } from '#/features/email-sync/data/mutations'
import { messageForApiError } from '#/lib/errorMessages'

export type InboxSettingsEditor = {
  draft: ConnectionSettings
  set: <TKey extends keyof ConnectionSettings>(
    key: TKey,
    value: ConnectionSettings[TKey],
  ) => void
  dirty: boolean
  saving: boolean
  error: string | null
  /** True when there was nothing to save or it saved. */
  save: () => Promise<boolean>
}

const settingsOf = (c: LocalEmailConnection): ConnectionSettings => ({
  autoSync: c.autoSync,
  scanFrequency: c.scanFrequency,
})

/**
 * The inbox's own settings as a draft, seeded once from the connection and PATCHed whole with
 * its version — rules are a separate document with their own version.
 */
export function useInboxSettings(
  connection: LocalEmailConnection,
): InboxSettingsEditor {
  const [draft, setDraft] = useState(() => settingsOf(connection))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = settingsOf(connection)
  const dirty =
    draft.autoSync !== saved.autoSync ||
    draft.scanFrequency !== saved.scanFrequency

  const save = async (): Promise<boolean> => {
    if (!dirty) return true
    setSaving(true)
    setError(null)
    try {
      await updateConnectionSettings(connection, draft)
      return true
    } catch (failure) {
      setError(messageForApiError(failure))
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    draft,
    set: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    dirty,
    saving,
    error,
    save,
  }
}
