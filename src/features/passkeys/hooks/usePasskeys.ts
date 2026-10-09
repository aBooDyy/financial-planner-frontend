import { useCallback, useEffect, useState } from 'react'
import { passkeysApi } from '#/features/passkeys/api/passkeysApi'
import type { Passkey } from '#/features/passkeys/api/types'
import { hasCode } from '#/features/passkeys/data/ceremony'
import { useOnline } from '#/hooks/useOnline'
import { messageForApiError } from '#/lib/errorMessages'

export type PasskeysModel = {
  /** Newest first; null until the server has answered once. */
  passkeys: Passkey[] | null
  online: boolean
  loadError: string | null
  added: (passkey: Passkey) => void
  /** Rejects with the server's error, after refreshing the list when it was out of date. */
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

/** The user's passkeys, straight from the server: loaded on mount and again on reconnect. */
export function usePasskeys(): PasskeysModel {
  const online = useOnline()
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setPasskeys(await passkeysApi.list())
      setLoadError(null)
    } catch (error) {
      setLoadError(messageForApiError(error))
    }
  }, [])

  useEffect(() => {
    if (online) void load()
  }, [online, load])

  const replace = (next: Passkey) =>
    setPasskeys(
      (rows) => rows?.map((p) => (p.id === next.id ? next : p)) ?? null,
    )

  const drop = (id: string) =>
    setPasskeys((rows) => rows?.filter((p) => p.id !== id) ?? null)

  const rename = async (id: string, name: string) => {
    const current = passkeys?.find((p) => p.id === id)
    if (!current) return
    try {
      replace(await passkeysApi.rename(id, { name, version: current.version }))
    } catch (error) {
      if (hasCode(error, 'common.conflict')) await load()
      if (hasCode(error, 'auth.passkey.not_found')) drop(id)
      throw error
    }
  }

  const remove = async (id: string) => {
    try {
      await passkeysApi.remove(id)
    } catch (error) {
      if (!hasCode(error, 'auth.passkey.not_found')) throw error
    }
    drop(id)
  }

  const added = (passkey: Passkey) =>
    setPasskeys((rows) => [
      passkey,
      ...(rows ?? []).filter((p) => p.id !== passkey.id),
    ])

  return { passkeys, online, loadError, added, rename, remove }
}
