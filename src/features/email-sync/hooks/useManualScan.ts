import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ScanOptions,
  SyncFailure,
  SyncResult,
} from '#/features/email-sync/api/types'
import { runEmailSync } from '#/features/email-sync/data/mutations'
import { configLimits } from '#/lib/config/appConfig'
import { messageForApiError, messageForCode } from '#/lib/errorMessages'

/**
 * Per-connection cap for a scan the user asked for. Sent on every manual scan so the
 * request is never an empty body — the backend reads an empty body as the automatic
 * login scan, which skips inboxes with auto-sync off. It also stands in as the fallback
 * when the server's own cap isn't known yet.
 */
export const MANUAL_SCAN_LIMIT = 100

/** Never ask for more than the server accepts; `email_sync_max_limit` is its cap. */
const manualScanLimit = (): number =>
  Math.min(MANUAL_SCAN_LIMIT, configLimits().emailSyncMaxLimit)

/**
 * The backend runs one scan per user at a time and refuses a second with
 * `409 email_sync.sync.in_progress`. That is not a failure — the inbox is being read right
 * now and re-staging is idempotent — so one short-backoff retry covers the common case of
 * the login scan still running when the user presses the button.
 */
export const IN_PROGRESS_CODE = 'email_sync.sync.in_progress'
const IN_PROGRESS_RETRY_MS = 4000

export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  /** Someone else's scan holds the slot. Waiting, not failing. */
  | { status: 'busy'; message: string }
  | { status: 'done'; result: SyncResult }
  | { status: 'failed'; code: string; message: string }

/** The result of a scan, already worded — including the honest nothing-new case. */
export type ScanSummary = {
  line: string
  /** Set when some inboxes could not be read; the counts above exclude them. */
  note: string | null
  /** Imports this scan left waiting, i.e. what a "Review" link would open. */
  reviewCount: number
}

export type ManualScan = {
  state: ScanState
  summary: ScanSummary | null
  scan: (options?: ScanOptions) => Promise<void>
  reset: () => void
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const failureNote = (failures: SyncFailure[]): string | null => {
  if (failures.length === 0) return null
  if (failures.length === 1) {
    return messageForCode(
      failures[0].code,
      'One inbox couldn’t be read, so its emails weren’t scanned.',
    )
  }
  return `${failures.length} inboxes couldn’t be read, so their emails weren’t scanned.`
}

const summaryLine = (result: SyncResult): string => {
  const { scannedMessages, newImports, autoConfirmed, failures } = result
  const scanned = `Scanned ${scannedMessages} ${plural(scannedMessages, 'email', 'emails')}`

  if (result.syncedConnections === 0 && failures.length > 0) {
    return 'Nothing was scanned.'
  }
  if (scannedMessages === 0) {
    return 'No new emails to scan — you’re up to date.'
  }
  if (newImports === 0) {
    return `${scanned} · nothing new. Everything from your tracked senders is already in.`
  }

  const parts = [scanned, `${newImports} new`]
  if (autoConfirmed > 0) parts.push(`${autoConfirmed} logged automatically`)
  const needReview = newImports - autoConfirmed
  if (needReview > 0) parts.push(`${needReview} need review`)
  return parts.join(' · ')
}

const toSummary = (result: SyncResult): ScanSummary => ({
  line: summaryLine(result),
  note: failureNote(result.failures),
  reviewCount: Math.max(result.newImports - result.autoConfirmed, 0),
})

const codeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''

/**
 * Runs a scan the user asked for and reports what it found. Single-flight: a second call
 * while one is in the air is dropped rather than queued, so a double tap cannot fan out
 * into two provider round-trips.
 */
export function useManualScan(): ManualScan {
  const [state, setState] = useState<ScanState>({ status: 'idle' })
  const running = useRef(false)
  const mounted = useRef(true)

  // Re-arm on mount, not just on unmount: a remount reuses the same ref, and leaving it
  // false would make every later scan discard its own result.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const scan = useCallback(async (options: ScanOptions = {}) => {
    if (running.current) return
    running.current = true
    const request = { limit: manualScanLimit(), ...options }
    const alive = () => mounted.current
    setState({ status: 'scanning' })
    try {
      let result: SyncResult
      try {
        result = await runEmailSync(request)
      } catch (error) {
        if (codeOf(error) !== IN_PROGRESS_CODE) throw error
        if (!alive()) return
        setState({ status: 'busy', message: messageForCode(IN_PROGRESS_CODE) })
        await new Promise((resolve) =>
          setTimeout(resolve, IN_PROGRESS_RETRY_MS),
        )
        if (!alive()) return
        setState({ status: 'scanning' })
        result = await runEmailSync(request)
      }
      if (alive()) setState({ status: 'done', result })
    } catch (error) {
      if (!alive()) return
      const code = codeOf(error)
      // A scan still running after the retry is still not a failure: it is doing the work.
      setState(
        code === IN_PROGRESS_CODE
          ? { status: 'busy', message: messageForCode(IN_PROGRESS_CODE) }
          : { status: 'failed', code, message: messageForApiError(error) },
      )
    } finally {
      running.current = false
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return {
    state,
    summary: state.status === 'done' ? toSummary(state.result) : null,
    scan,
    reset,
  }
}
