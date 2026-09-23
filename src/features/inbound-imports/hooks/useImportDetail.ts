import { useEffect, useState } from 'react'
import { inboundImportsApi } from '#/features/inbound-imports/api/inboundImportsApi'
import type { ImportDetail } from '#/features/inbound-imports/api/types'

type ImportDetailSource =
  | { kind: 'import'; id: string }
  | { kind: 'transaction'; id: string }

type State = {
  detail: ImportDetail | null
  loading: boolean
  error: string | null
}

const IDLE: State = { detail: null, loading: false, error: null }

/**
 * Load the stored body behind an import (or behind the ledger entry it produced). Bodies are
 * fetched per item rather than cached with the list — most imports are never opened.
 * `enabled` keeps the request from firing until the user actually asks to see the body.
 */
export function useImportDetail(
  source: ImportDetailSource | null,
  enabled: boolean,
): State {
  const [state, setState] = useState<State>(IDLE)
  const kind = source?.kind
  const id = source?.id

  useEffect(() => {
    if (!enabled || !kind || !id) return
    let active = true
    setState({ detail: null, loading: true, error: null })
    const request =
      kind === 'import'
        ? inboundImportsApi.getImport(id)
        : inboundImportsApi.getImportByTransaction(id)
    request
      .then((detail) => {
        if (active) setState({ detail, loading: false, error: null })
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
  }, [enabled, kind, id])

  return state
}
