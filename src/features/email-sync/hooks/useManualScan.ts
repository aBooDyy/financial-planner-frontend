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

/**
 * One press catches up: an inbox that held more than one scan reads says so, and the scan
 * runs again — up to this many times, so a very full inbox cannot keep the button busy.
 */
export const MAX_CATCH_UP_ROUNDS = 5

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
  /** `round` counts the catch-up passes; 1 is the press itself. */
  | { status: 'scanning'; round: number }
  /** Someone else's scan holds the slot. Waiting, not failing. */
  | { status: 'busy'; message: string }
  | { status: 'done'; result: SyncResult; more: boolean }
  | { status: 'failed'; code: string; message: string }

/** The result of a scan, already worded — including the honest nothing-new case. */
export type ScanSummary = {
  line: string
  /** Set when some inboxes could not be read, or more remains; the counts above stand. */
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

const MORE_NOTE = 'There’s more to read — sync again to keep going.'

const summaryLine = (result: SyncResult): string => {
  const { scannedMessages, newImports, autoConfirmed, ignored, failures } =
    result
  const scanned = `Scanned ${scannedMessages} ${plural(scannedMessages, 'email', 'emails')}`

  if (result.syncedConnections === 0 && failures.length > 0) {
    return 'Nothing was scanned.'
  }
  if (scannedMessages === 0) {
    return 'No new emails to scan — you’re up to date.'
  }
  if (newImports === 0) {
    const skipped = ignored > 0 ? ` ${ignored} didn’t match any rule.` : ''
    return `${scanned} · nothing new. Everything from your tracked senders is already in.${skipped}`
  }

  const parts = [scanned, `${newImports} new`]
  if (autoConfirmed > 0) parts.push(`${autoConfirmed} logged automatically`)
  const needReview = newImports - autoConfirmed
  if (needReview > 0) parts.push(`${needReview} need review`)
  if (ignored > 0) parts.push(`${ignored} didn’t match a rule`)
  return parts.join(' · ')
}

const toSummary = (result: SyncResult, more: boolean): ScanSummary => ({
  line: summaryLine(result),
  note: failureNote(result.failures) ?? (more ? MORE_NOTE : null),
  reviewCount: Math.max(result.newImports - result.autoConfirmed, 0),
})

const codeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''

/** Inboxes this round read only part of — the next round picks up where it stopped. */
const unfinished = (result: SyncResult): string[] =>
  result.connections.filter((c) => !c.complete).map((c) => c.connectionId)

/** Every round's counts added up; an inbox that failed in any round is reported once. */
export function combineResults(a: SyncResult, b: SyncResult): SyncResult {
  const failed = new Map(a.failures.map((f) => [f.connectionId, f]))
  for (const f of b.failures) failed.set(f.connectionId, f)
  return {
    syncedConnections: Math.max(a.syncedConnections, b.syncedConnections),
    scannedMessages: a.scannedMessages + b.scannedMessages,
    newImports: a.newImports + b.newImports,
    autoConfirmed: a.autoConfirmed + b.autoConfirmed,
    ignored: a.ignored + b.ignored,
    failures: [...failed.values()],
    connections: b.connections,
  }
}

/** The next round's request: only the inbox still behind, when there is just one. */
const nextRound = (
  request: ScanOptions & { limit: number },
  behind: string[],
): ScanOptions & { limit: number } =>
  request.connectionId || behind.length !== 1
    ? request
    : { ...request, connectionId: behind[0] }

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

    const once = async (
      round: number,
      body: ScanOptions,
    ): Promise<SyncResult | null> => {
      setState({ status: 'scanning', round })
      try {
        return await runEmailSync(body)
      } catch (error) {
        if (codeOf(error) !== IN_PROGRESS_CODE) throw error
        if (!alive()) return null
        setState({ status: 'busy', message: messageForCode(IN_PROGRESS_CODE) })
        await new Promise((resolve) =>
          setTimeout(resolve, IN_PROGRESS_RETRY_MS),
        )
        if (!alive()) return null
        setState({ status: 'scanning', round })
        return await runEmailSync(body)
      }
    }

    try {
      let total = await once(1, request)
      if (!total || !alive()) return
      let behind = unfinished(total)
      for (
        let round = 2;
        behind.length > 0 && round <= MAX_CATCH_UP_ROUNDS;
        round += 1
      ) {
        const next = await once(round, nextRound(request, behind))
        if (!next || !alive()) return
        total = combineResults(total, next)
        behind = unfinished(next)
      }
      setState({ status: 'done', result: total, more: behind.length > 0 })
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
    summary:
      state.status === 'done' ? toSummary(state.result, state.more) : null,
    scan,
    reset,
  }
}
