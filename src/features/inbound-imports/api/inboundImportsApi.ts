import type { ChangesPage, ChangesQuery, ChangesWire } from '#/db/changes'
import { changesPath, toChangesPage } from '#/db/changes'
import { http } from '#/lib/http'
import type {
  ConfirmImportWire,
  ConfirmResult,
  ConfirmResultWire,
  ImportDetail,
  ImportDetailWire,
  ImportStatus,
  InboundImport,
  InboundImportWire,
} from './types'
import { toConfirmResult, toImportDetail, toInboundImport } from './types'

const IMPORTS = '/inbound-imports'
const importPath = (id: string) => `${IMPORTS}/${encodeURIComponent(id)}`

/**
 * Remote calls for the review queue. Like email sync, the UI calls these directly (the rows
 * are server-owned); results are cached into Dexie for reactive reads.
 */
export const inboundImportsApi = {
  listImports: (status?: ImportStatus): Promise<InboundImport[]> =>
    http
      .get<
        InboundImportWire[]
      >(`${IMPORTS}${status ? `?status=${status.toUpperCase()}` : ''}`)
      .then((r) => r.map(toInboundImport)),

  /** One page of the import delta. Unlike `listImports`, it carries every status. */
  importChanges: (query: ChangesQuery): Promise<ChangesPage<InboundImport>> =>
    http
      .get<ChangesWire<InboundImportWire>>(changesPath(IMPORTS, query))
      .then((w) => toChangesPage(w, toInboundImport)),

  /** One import with the body it was derived from — fetched on demand, not in the list. */
  getImport: (id: string): Promise<ImportDetail> =>
    http.get<ImportDetailWire>(importPath(id)).then(toImportDetail),

  /** The source behind a ledger entry; rejects for manually entered transactions. */
  getImportByTransaction: (transactionId: string): Promise<ImportDetail> =>
    http
      .get<ImportDetailWire>(
        `${IMPORTS}/by-transaction/${encodeURIComponent(transactionId)}`,
      )
      .then(toImportDetail),

  confirmImport: (
    id: string,
    payload: ConfirmImportWire,
  ): Promise<ConfirmResult> =>
    http
      .post<ConfirmResultWire>(`${importPath(id)}/confirm`, payload)
      .then(toConfirmResult),

  dismissImport: (id: string): Promise<InboundImport> =>
    http
      .post<InboundImportWire>(`${importPath(id)}/dismiss`)
      .then(toInboundImport),
}
