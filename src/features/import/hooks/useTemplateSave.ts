import { useCallback, useMemo, useState } from 'react'
import {
  configFromDraft,
  suggestTemplateName,
} from '#/features/import/data/templates'
import { MAX_TEMPLATE_NAME } from '#/features/import/data/mutations'
import type { LocalImportTemplate } from '#/db/types'
import type {
  TemplateSavePlan,
  TemplateSession,
} from '#/features/import/data/mutations'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { TemplatePicker } from '#/features/import/hooks/useTemplatePicker'

/**
 * The footer's save semantics. It holds a choice, not a write: nothing reaches the database
 * until the import commits, and *don't save* commits nothing at all.
 */

export type TemplateSaveMode = 'update' | 'new' | 'none'

export type TemplateSave = {
  mode: TemplateSaveMode
  setMode: (mode: TemplateSaveMode) => void
  /** The template *Update* would overwrite, when the import started from one. */
  target: LocalImportTemplate | null
  name: string
  setName: (name: string) => void
  /** Why the name cannot be used, shown under the field rather than at commit time. */
  nameError: string | null
  plan: TemplateSavePlan
  session: TemplateSession | null
}

export function useTemplateSave(
  csv: CsvImport,
  picker: TemplatePicker,
): TemplateSave {
  const [chosen, setChosen] = useState<TemplateSaveMode | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const { applied: target, templates } = picker

  // The default is whatever the user started from in step ①, per 02 §③.
  const mode: TemplateSaveMode = chosen ?? (target === null ? 'none' : 'update')
  const name = typed ?? suggestTemplateName(csv.file?.name ?? '')

  const nameError = useMemo(() => {
    if (mode !== 'new') return null
    const trimmed = name.trim()
    if (trimmed === '') return 'Give the template a name.'
    if (trimmed.length > MAX_TEMPLATE_NAME) return 'That name is too long.'
    if (templates.some((t) => t.name.trim() === trimmed)) {
      return 'You already have a template with that name.'
    }
    return null
  }, [mode, name, templates])

  const session: TemplateSession | null = useMemo(() => {
    if (csv.draft === null || csv.file === null) return null
    return {
      signature: picker.signature ?? '',
      config: configFromDraft(csv.draft),
      usedTemplateId: target?.id ?? null,
    }
  }, [csv.draft, csv.file, picker.signature, target])

  const plan: TemplateSavePlan = useMemo(() => {
    if (mode === 'update' && target !== null)
      return { mode: 'update', id: target.id }
    if (mode === 'new' && nameError === null)
      return { mode: 'new', name: name.trim() }
    return { mode: 'none' }
  }, [mode, target, name, nameError])

  const setMode = useCallback((next: TemplateSaveMode) => setChosen(next), [])
  const setName = useCallback((next: string) => setTyped(next), [])

  return { mode, setMode, target, name, setName, nameError, plan, session }
}
