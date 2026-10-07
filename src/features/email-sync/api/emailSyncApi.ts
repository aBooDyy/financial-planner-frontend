import { http } from '#/lib/http'
import type {
  AuthorizeUrlWire,
  ConnectionWire,
  EmailConnection,
  EmailProvider,
  EmailRuleDraft,
  EmailRuleSet,
  EmailRuleSetWire,
  EmailSample,
  InboxMessage,
  LearnRequest,
  LearnResult,
  LearnResultWire,
  MessageWire,
  SampleVerdict,
  ScanOptions,
  SyncResult,
  SyncResultWire,
  TestRequestWire,
  TestResultWire,
  UpdateConnectionWire,
} from './types'
import {
  toConnection,
  toLearnRequestWire,
  toLearnResult,
  toMessage,
  toRuleDraftWire,
  toRuleSet,
  toSampleVerdict,
  toSampleWire,
  toSyncOptionsWire,
  toSyncResult,
  toWireProvider,
} from './types'

const CONN = '/email-connections'
const connPath = (id: string) => `${CONN}/${encodeURIComponent(id)}`

export type MessageQuery = { limit?: number; sender?: string }

const messageQuery = ({ limit, sender }: MessageQuery): string => {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (sender) params.set('sender', sender)
  const text = params.toString()
  return text ? `?${text}` : ''
}

/**
 * Remote calls for Email sync. Unlike the offline-first features, the UI calls these directly
 * (the feature is inherently online); connections are cached into Dexie for reactive reads,
 * rules are fetched when an inbox's editor opens and never cached.
 */
export const emailSyncApi = {
  /** With `connectionId`, the URL signs that inbox in again instead of adding one. */
  authorizeUrl: (
    provider: EmailProvider,
    connectionId?: string,
  ): Promise<AuthorizeUrlWire> =>
    http.post<AuthorizeUrlWire>(
      `${CONN}/oauth/${toWireProvider(provider)}/authorize-url`,
      connectionId ? { connection_id: connectionId } : undefined,
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
    http.patch<ConnectionWire>(connPath(id), payload).then(toConnection),

  disconnect: (id: string): Promise<void> =>
    http.del<void>(connPath(id)).then(() => undefined),

  listMessages: (
    id: string,
    query: MessageQuery = {},
  ): Promise<InboxMessage[]> =>
    http
      .get<MessageWire[]>(`${connPath(id)}/messages${messageQuery(query)}`)
      .then((r) => r.map(toMessage)),

  getRules: (id: string): Promise<EmailRuleSet> =>
    http.get<EmailRuleSetWire>(`${connPath(id)}/rules`).then(toRuleSet),

  replaceRules: (
    id: string,
    version: string,
    rules: EmailRuleDraft[],
  ): Promise<EmailRuleSet> =>
    http
      .put<EmailRuleSetWire>(`${connPath(id)}/rules`, {
        version,
        rules: rules.map(toRuleDraftWire),
      })
      .then(toRuleSet),

  /** Distils the user's picks on a sample into a template, and reads the group with it. */
  learn: (id: string, request: LearnRequest): Promise<LearnResult> =>
    http
      .post<LearnResultWire>(
        `${connPath(id)}/rules/learn`,
        toLearnRequestWire(request),
      )
      .then(toLearnResult),

  /** Writes nothing. `rules` tries unsaved rules instead of the saved ones. */
  test: (
    id: string,
    samples: EmailSample[],
    rules?: EmailRuleDraft[],
    focusIndex?: number,
  ): Promise<SampleVerdict[]> => {
    const body: TestRequestWire = { samples: samples.map(toSampleWire) }
    if (rules) body.rules = rules.map(toRuleDraftWire)
    if (focusIndex !== undefined) body.focus_index = focusIndex
    return http
      .post<TestResultWire>(`${connPath(id)}/rules/test`, body)
      .then((r) => r.results.map(toSampleVerdict))
  },

  /** No options = the automatic scan the backend has always run; any option makes it manual. */
  syncAll: (options?: ScanOptions): Promise<SyncResult> =>
    http
      .post<SyncResultWire>(
        `${CONN}/sync`,
        options ? toSyncOptionsWire(options) : undefined,
      )
      .then(toSyncResult),
}
