import { http } from '#/lib/http'
import type {
  CreateImportTemplateWire,
  ImportTemplate,
  ImportTemplateWire,
  UpdateImportTemplateWire,
} from './types'
import { toImportTemplate } from './types'

/**
 * Remote calls for import templates. The sync engine owns when these run; the wizard reads
 * templates from the local DB so a saved mapping is there offline, on the plane, too.
 */
export const importTemplatesApi = {
  /** `signature` narrows the list server-side; the client matches locally either way. */
  list: (signature?: string): Promise<ImportTemplate[]> =>
    http
      .get<
        ImportTemplateWire[]
      >(signature === undefined ? '/import-templates' : `/import-templates?signature=${encodeURIComponent(signature)}`)
      .then((r) => r.map(toImportTemplate)),
  create: (payload: CreateImportTemplateWire): Promise<ImportTemplate> =>
    http
      .post<ImportTemplateWire>('/import-templates', payload)
      .then(toImportTemplate),
  update: (
    id: string,
    payload: UpdateImportTemplateWire,
  ): Promise<ImportTemplate> =>
    http
      .patch<ImportTemplateWire>(`/import-templates/${id}`, payload)
      .then(toImportTemplate),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/import-templates/${id}`).then(() => undefined),
}
