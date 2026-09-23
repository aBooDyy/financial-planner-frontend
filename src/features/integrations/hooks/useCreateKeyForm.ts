import { useState } from 'react'
import type { CreatedKey, NewKey } from '#/features/integrations/api/types'
import { failureMessage } from '#/features/integrations/data/errors'
import type { KeyFailure, KeyField } from '#/features/integrations/data/errors'
import type { KeyOutcome } from './useIntegrationKeys'

export const KEY_NAME_MAX = 120

/** The fields step one asks for; an error about any other lands in the general line. */
const SHOWN: ReadonlyArray<KeyField> = ['name', 'expiresAt', 'defaultWalletId']

const blank = (name = ''): NewKey => ({
  name,
  expiresAt: null,
  defaultWalletId: null,
})

/** Step one of creating a key: the draft, its validation, and the one server call. */
export function useCreateKeyForm(
  initialName: string,
  create: (draft: NewKey) => Promise<KeyOutcome<CreatedKey>>,
  onCreated: (created: CreatedKey) => void,
) {
  const [draft, setDraft] = useState<NewKey>(() => blank(initialName))
  const [failure, setFailure] = useState<KeyFailure | null>(null)
  const [saving, setSaving] = useState(false)

  const name = draft.name.trim()
  const valid = name.length > 0 && name.length <= KEY_NAME_MAX

  const set = <TField extends keyof NewKey>(
    field: TField,
    value: NewKey[TField],
  ) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setFailure(null)
  }

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    const outcome = await create({ ...draft, name })
    setSaving(false)
    if (outcome.ok) onCreated(outcome.value)
    else setFailure(outcome.failure)
  }

  return {
    draft,
    set,
    submit,
    valid,
    saving,
    errorFor: (field: KeyField): string | null =>
      failure?.fields[field] ?? null,
    general: failure ? failureMessage(failure, SHOWN) : null,
  }
}
