import { useState } from 'react'
import {
  deleteImportTemplate,
  renameImportTemplate,
} from '#/features/import/data/mutations'
import { rankTemplates } from '#/features/import/data/templates'
import { useSavedTemplates } from '#/features/import/hooks/useSavedTemplates'
import { messageForApiError } from '#/lib/errorMessages'
import { ImportTemplateRow } from './ImportTemplateRow'
import type { LocalImportTemplate } from '#/db/types'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

/** The file values a template answers for, as the row lists them. */
const answersOf = (template: LocalImportTemplate): string[] => {
  const config = template.config
  if (config === null) return []
  return [
    ...Object.keys(config.aliases.wallets),
    ...Object.keys(config.aliases.categories),
    ...Object.keys(config.aliases.merchants),
    ...Object.keys(config.aliases.types),
    ...Object.keys(config.aliases.currencies),
  ].filter((key) => key !== '')
}

/**
 * Saved import mappings, most recently used first. Deleting one never touches the
 * transactions it brought in — it only forgets how to read that file again.
 */
export function ImportTemplatesCard() {
  const { templates } = useSavedTemplates()
  const [error, setError] = useState<string | null>(null)

  // A parked row needs a rename before it can sync, so it goes where the eye lands. This
  // card is the only place that says so — there is no global "something can't sync" cue.
  const rows = rankTemplates(templates, null).sort(
    (a, b) => b.nameConflict - a.nameConflict,
  )

  const rename = async (id: string, name: string) => {
    setError(null)
    try {
      await renameImportTemplate(id, name)
    } catch (e) {
      setError(messageForApiError(e))
    }
  }

  return (
    <div className={`${CARD} flex flex-col`}>
      <div className="px-[18px] pb-[13px] pt-[18px]">
        <div className="text-[15px] font-bold">Import templates</div>
        <div className="mt-[3px] text-[12.5px] text-fp-text-3">
          Saved mappings for files you import regularly. They sync, so one saved
          here is there on your phone too.
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mx-[18px] mb-3 rounded-xl border border-fp-danger/30 bg-fp-danger/10 px-3 py-2 text-[12.5px] text-fp-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="border-t border-fp-border">
        {rows.length === 0 ? (
          <div className="px-[18px] py-6 text-[13px] text-fp-text-3">
            No saved templates yet — the last step of a file import offers to
            save one.
          </div>
        ) : (
          rows.map((template, index) => (
            <ImportTemplateRow
              key={template.id}
              template={template}
              answers={answersOf(template)}
              onRename={(name) => void rename(template.id, name)}
              onDelete={() => void deleteImportTemplate(template.id)}
              last={index === rows.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}
