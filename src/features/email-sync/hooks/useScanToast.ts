import { useEffect, useState } from 'react'
import type {
  ScanState,
  ScanSummary,
} from '#/features/email-sync/hooks/useManualScan'

/** How long a result with nothing to act on stays up. */
export const SCAN_TOAST_MS = 5000

export type ScanToast = {
  open: boolean
  dismiss: () => void
}

/**
 * Whether the sync toast shows. A dismissal holds for the state it was made on only, so
 * closing the progress still lets the result through. A result stays until closed while it
 * asks for something — a retry or a review — and fades on its own otherwise.
 */
export function useScanToast(
  state: ScanState,
  summary: ScanSummary | null,
): ScanToast {
  const [dismissedFor, setDismissedFor] = useState<ScanState | null>(null)
  const settles = state.status === 'done' && (summary?.reviewCount ?? 0) === 0

  useEffect(() => {
    if (!settles) return
    const timer = setTimeout(() => setDismissedFor(state), SCAN_TOAST_MS)
    return () => clearTimeout(timer)
  }, [settles, state])

  return {
    open: state.status !== 'idle' && dismissedFor !== state,
    dismiss: () => setDismissedFor(state),
  }
}
