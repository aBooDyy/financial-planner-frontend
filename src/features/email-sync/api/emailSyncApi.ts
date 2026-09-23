import { http } from '#/lib/http'
import type {
  AuthorizeUrlWire,
  ConnectionWire,
  EmailConnection,
  EmailProvider,
  InboxMessage,
  MessageWire,
  RuleDraftWire,
  ScanOptions,
  SyncResult,
  SyncResultWire,
  UpdateConnectionWire,
} from './types'
import {
  toConnection,
  toMessage,
  toSyncOptionsWire,
  toSyncResult,
  toWireProvider,
} from './types'

const CONN = '/email-connections'

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

  /** No options = the automatic scan the backend has always run; any option makes it manual. */
  syncAll: (options?: ScanOptions): Promise<SyncResult> =>
    http
      .post<SyncResultWire>(
        `${CONN}/sync`,
        options ? toSyncOptionsWire(options) : undefined,
      )
      .then(toSyncResult),
}
