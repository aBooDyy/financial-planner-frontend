import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalIntegrationKey } from '#/db/types'
import type {
  CreatedKey,
  IntegrationKey,
  KeySettings,
  NewKey,
} from '#/features/integrations/api/types'
import { pullIntegrationKeys } from '#/features/integrations/data/cache'
import { keyFailure } from '#/features/integrations/data/errors'
import type { KeyFailure } from '#/features/integrations/data/errors'
import { byListOrder } from '#/features/integrations/data/mappers'
import {
  createKey,
  deleteKey,
  revokeKey,
  rotateKey,
  updateKey,
} from '#/features/integrations/data/mutations'
import { useOnline } from '#/hooks/useOnline'

export type KeyOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; failure: KeyFailure }

const attempt =
  <TArgs extends unknown[], T>(fn: (...args: TArgs) => Promise<T>) =>
  async (...args: TArgs): Promise<KeyOutcome<T>> => {
    try {
      return { ok: true, value: await fn(...args) }
    } catch (error) {
      return { ok: false, failure: keyFailure(error) }
    }
  }

const ACTIONS = {
  create: attempt((draft: NewKey): Promise<CreatedKey> => createKey(draft)),
  update: attempt(
    (key: IntegrationKey, settings: KeySettings): Promise<IntegrationKey> =>
      updateKey(key, settings),
  ),
  revoke: attempt(revokeKey),
  rotate: attempt(rotateKey),
  remove: attempt(deleteKey),
}

export type KeyActions = typeof ACTIONS

type IntegrationKeysModel = KeyActions & {
  keys: LocalIntegrationKey[]
  loading: boolean
  online: boolean
  /** The last refresh failed; `keys` is what this device cached before. */
  stale: boolean
}

/**
 * The user's webhook keys: rendered from the Dexie cache first, refreshed from the server on
 * mount and whenever the device comes back online. Mutations call the API and report an
 * outcome instead of throwing, so a dialog can put the error beside the field it is about.
 */
export function useIntegrationKeys(): IntegrationKeysModel {
  const rows = useLiveQuery(() => db.integrationKeys.toArray())
  const online = useOnline()
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!online) return
    let cancelled = false
    pullIntegrationKeys().then(
      () => !cancelled && setStale(false),
      () => !cancelled && setStale(true),
    )
    return () => {
      cancelled = true
    }
  }, [online])

  const keys = useMemo(() => [...(rows ?? [])].sort(byListOrder), [rows])

  return {
    keys,
    loading: rows === undefined,
    online,
    stale: stale || !online,
    ...ACTIONS,
  }
}
