import { useState } from 'react'
import type {
  IntegrationKey,
  KeySettings,
} from '#/features/integrations/api/types'
import { settingsOf } from '#/features/integrations/api/types'
import { applyEdit, draftProblems } from '#/features/integrations/data/draft'
import { failureMessage } from '#/features/integrations/data/errors'
import type { KeyFailure, KeyField } from '#/features/integrations/data/errors'
import type { KeyOutcome } from './useIntegrationKeys'

export type KeyEditor = {
  draft: KeySettings
  set: <TField extends keyof KeySettings>(
    field: TField,
    value: KeySettings[TField],
  ) => void
  errorFor: (field: KeyField) => string | null
  /** An error about the key as a whole — shown once, not beside a field. */
  general: string | null
  dirty: boolean
  saving: boolean
  canSave: boolean
  save: () => Promise<boolean>
}

/** Every field the editor shows; an error about any other goes in the footer. */
const EDITOR_FIELDS: ReadonlyArray<KeyField> = [
  'name',
  'expiresAt',
  'defaultWalletId',
  'defaultCategoryId',
  'defaultCurrency',
  'autoConfirm',
  'rateLimitPerMinute',
]

/** The key editor's draft: seeded from the key once, validated locally, saved in one PATCH. */
export function useKeyEditor(
  key: IntegrationKey,
  update: (
    key: IntegrationKey,
    settings: KeySettings,
  ) => Promise<KeyOutcome<IntegrationKey>>,
): KeyEditor {
  const [draft, setDraft] = useState<KeySettings>(() => settingsOf(key))
  const [failure, setFailure] = useState<KeyFailure | null>(null)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)

  const problems = draftProblems(draft)
  const valid = Object.keys(problems).length === 0

  const set: KeyEditor['set'] = (field, value) => {
    setDraft((d) => applyEdit(d, field, value))
    setTouched(true)
    setFailure(null)
  }

  const errorFor = (field: KeyField): string | null =>
    problems[field] ?? failure?.fields[field] ?? null

  const save = async (): Promise<boolean> => {
    if (!valid || saving) return false
    setSaving(true)
    const outcome = await update(key, { ...draft, name: draft.name.trim() })
    setSaving(false)
    if (outcome.ok) return true
    setFailure(outcome.failure)
    return false
  }

  return {
    draft,
    set,
    errorFor,
    general: failure ? failureMessage(failure, EDITOR_FIELDS) : null,
    dirty: touched,
    saving,
    canSave: valid && touched && !saving,
    save,
  }
}
