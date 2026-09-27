import { useEffect, useRef, useState } from 'react'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { ImportDetail } from '#/features/inbound-imports/api/types'
import { useOnline } from '#/hooks/useOnline'

type ImportDetailSource =
  | { kind: 'import'; id: string }
  | { kind: 'transaction'; id: string }

type State = {
  detail: ImportDetail | null
  loading: boolean
  error: string | null
}

const IDLE: State = { detail: null, loading: false, error: null }
const OFFLINE: State = {
  detail: null,
  loading: false,
  error: 'The original message loads when you’re back online.',
}

/**
 * Load the stored body behind an import (or behind the ledger entry it produced). Bodies are
 * fetched per item rather than cached with the list — most imports are never opened.
 * `enabled` keeps the request from firing until the user actually asks to see the body.
 * Offline it waits, and loads once the connection returns.
 */
export function useImportDetail(
  source: ImportDetailSource | null,
  enabled: boolean,
): State {
  const [state, setState] = useState<State>(IDLE)
  const kind = source?.kind
  const id = source?.id
  const online = useOnline()
  // Which source the body on screen belongs to, so reconnecting doesn't reload it.
  const loadedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !kind || !id || !online) return
    const key = `${kind}:${id}`
    if (loadedKey.current === key) return
    loadedKey.current = null
    let active = true
    setState({ detail: null, loading: true, error: null })
    const request =
      kind === 'import'
        ? inboundImportsApi.getImport(id)
        : inboundImportsApi.getImportByTransaction(id)
    request
      .then((detail) => {
        if (!active) return
        loadedKey.current = key
        setState({ detail, loading: false, error: null })
      })
      .catch(() => {
        if (active)
          setState({
            detail: null,
            loading: false,
            error: 'Could not load the original message.',
          })
      })
    return () => {
      active = false
    }
  }, [enabled, kind, id, online])

  if (enabled && !online && !state.detail) return OFFLINE
  return state
}
