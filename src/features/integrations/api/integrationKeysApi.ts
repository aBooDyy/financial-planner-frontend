import { http } from '#/lib/http'
import type {
  CreatedKey,
  CreatedKeyWire,
  IntegrationKey,
  IntegrationKeyWire,
  KeySettings,
  NewKey,
} from './types'
import {
  toCreateKeyWire,
  toCreatedKey,
  toIntegrationKey,
  toUpdateKeyWire,
} from './types'

const KEYS = '/integration-keys'
const keyPath = (id: string) => `${KEYS}/${encodeURIComponent(id)}`

/**
 * Remote calls for integration keys. Keys are server-minted — the secret only exists once the
 * server makes it — so the UI calls these directly and caches the results into Dexie.
 */
export const integrationKeysApi = {
  list: (): Promise<IntegrationKey[]> =>
    http.get<IntegrationKeyWire[]>(KEYS).then((r) => r.map(toIntegrationKey)),

  create: (key: NewKey): Promise<CreatedKey> =>
    http.post<CreatedKeyWire>(KEYS, toCreateKeyWire(key)).then(toCreatedKey),

  update: (
    id: string,
    version: string,
    settings: KeySettings,
  ): Promise<IntegrationKey> =>
    http
      .patch<IntegrationKeyWire>(
        keyPath(id),
        toUpdateKeyWire(version, settings),
      )
      .then(toIntegrationKey),

  rotate: (id: string): Promise<CreatedKey> =>
    http.post<CreatedKeyWire>(`${keyPath(id)}/rotate`).then(toCreatedKey),

  remove: (id: string): Promise<void> =>
    http.del<void>(keyPath(id)).then(() => undefined),
}
