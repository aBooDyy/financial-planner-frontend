import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import { usableTemplates } from '#/features/import/data/templates'
import type { LocalImportTemplate } from '#/db/types'

/** The synced mapping templates this user has saved. */
export function useSavedTemplates(): {
  templates: LocalImportTemplate[]
  loading: boolean
} {
  const rows = useLiveQuery(() => db.importTemplates.toArray())
  return { templates: usableTemplates(rows ?? []), loading: rows === undefined }
}
