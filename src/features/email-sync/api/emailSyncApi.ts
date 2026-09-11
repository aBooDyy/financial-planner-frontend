import { http } from '#/lib/http'
import type {
  AuthorizeUrlWire,
  ConfirmImportWire,
  ConfirmResult,
  ConfirmResultWire,
  ConnectionWire,
  EmailConnection,
  EmailProvider,
  ImportDetail,
  ImportDetailWire,
  ImportStatus,
  ImportWire,
  InboxMessage,
  MessageWire,
  PendingImport,
  RuleDraftWire,
  SyncResult,
  SyncResultWire,
  UpdateConnectionWire,
} from './types'
import {
  toConfirmResult,
  toConnection,
  toImport,
  toImportDetail,
  toMessage,
  toSyncResult,
  toWireProvider,
} from './types'

const CONN = '/email-connections'
const IMPORTS = '/email-imports'

/**
 * Remote calls for Email sync. Unlike the offline-first features, the UI calls these directly
 * (the feature is inherently online); results are cached into Dexie for reactive reads.
 */
export const emailSyncApi = {
  authorizeUrl: (provider: EmailProvider): Promise<AuthorizeUrlWire> =>
    http.post<AuthorizeUrlWire>(
      `${CONN}/oauth/${toWireProvider(provider)}/authorize-url`,
    ),

  completeOAuth: (code: string, state: string): Promise<EmailConnection> =>
    http
      .post<ConnectionWire>(`${CONN}/oauth/callback`, { code, state })
      .then(toConnection),

  listConnections: (): Promise<EmailConnection[]> =>
    http.get<ConnectionWire[]>(CONN).then((r) => r.map(toConnection)),

  updateConnection: (
    id: string,
    payload: UpdateConnectionWire,
  ): Promise<EmailConnection> =>
    http.patch<ConnectionWire>(`${CONN}/${id}`, payload).then(toConnection),

  disconnect: (id: string): Promise<void> =>
    http.del<void>(`${CONN}/${id}`).then(() => undefined),

  listMessages: (id: string, limit?: number): Promise<InboxMessage[]> =>
    http
      .get<
        MessageWire[]
      >(`${CONN}/${id}/messages${limit ? `?limit=${limit}` : ''}`)
      .then((r) => r.map(toMessage)),

  createRules: (id: string, rules: RuleDraftWire[]): Promise<EmailConnection> =>
    http
      .post<ConnectionWire>(`${CONN}/${id}/rules`, { rules })
      .then(toConnection),

  syncAll: (): Promise<SyncResult> =>
    http.post<SyncResultWire>(`${CONN}/sync`).then(toSyncResult),

  listImports: (status?: ImportStatus): Promise<PendingImport[]> =>
    http
      .get<
        ImportWire[]
      >(`${IMPORTS}${status ? `?status=${status.toUpperCase()}` : ''}`)
      .then((r) => r.map(toImport)),

  /** One import with the email it was derived from — fetched on demand, not in the list. */
  getImport: (id: string): Promise<ImportDetail> =>
    http.get<ImportDetailWire>(`${IMPORTS}/${id}`).then(toImportDetail),

  /** The source email behind a ledger entry; rejects for manually entered transactions. */
  getImportByTransaction: (transactionId: string): Promise<ImportDetail> =>
    http
      .get<ImportDetailWire>(`${IMPORTS}/by-transaction/${transactionId}`)
      .then(toImportDetail),

  confirmImport: (
    id: string,
    payload: ConfirmImportWire,
  ): Promise<ConfirmResult> =>
    http
      .post<ConfirmResultWire>(`${IMPORTS}/${id}/confirm`, payload)
      .then(toConfirmResult),

  dismissImport: (id: string): Promise<PendingImport> =>
    http.post<ImportWire>(`${IMPORTS}/${id}/dismiss`).then(toImport),
}
