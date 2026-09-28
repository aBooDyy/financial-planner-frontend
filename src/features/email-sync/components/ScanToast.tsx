import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Check, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import type {
  ScanState,
  ScanSummary,
} from '#/features/email-sync/hooks/useManualScan'
import { cn } from '#/lib/utils'

type Props = {
  open: boolean
  state: ScanState
  summary: ScanSummary | null
  inbox: string
  /** The window a backfill reads, so the progress can name it. */
  lookbackDays?: number
  onRetry: () => void
  onDismiss: () => void
}

type Tone = 'progress' | 'done' | 'failed'

const CHIP: Record<Tone, string> = {
  progress: 'bg-fp-accent-soft text-fp-accent',
  done: 'bg-fp-accent-soft text-fp-accent',
  failed: 'bg-fp-danger/10 text-fp-danger',
}

const ICON: Record<Tone, ReactNode> = {
  progress: <Loader2 size={17} strokeWidth={2} className="animate-spin" />,
  done: <Check size={17} strokeWidth={2.4} />,
  failed: <AlertTriangle size={17} strokeWidth={2} />,
}

const toneOf = (state: ScanState): Tone =>
  state.status === 'done'
    ? 'done'
    : state.status === 'failed'
      ? 'failed'
      : 'progress'

const progressTitle = (state: ScanState, lookbackDays?: number): string => {
  if (state.status === 'busy') return 'Waiting for another sync…'
  if (state.status === 'scanning' && state.round > 1) return 'Catching up…'
  return lookbackDays
    ? `Reading the last ${lookbackDays} days…`
    : 'Checking for new emails…'
}

/**
 * A sync started from an inbox row, floating bottom-centre: progress while it runs, then
 * what it found or why it failed. Portalled so the settings card's overflow can't clip it.
 */
export function ScanToast({
  open,
  state,
  summary,
  inbox,
  lookbackDays,
  onRetry,
  onDismiss,
}: Props) {
  const tone = toneOf(state)
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 flex justify-center px-4 md:bottom-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      {open ? (
        <div className="pointer-events-auto flex w-full max-w-[420px] animate-in items-start gap-3 rounded-[16px] border border-fp-border bg-fp-surface py-3 ps-3 pe-2 shadow-fp fade-in-0 slide-in-from-bottom-2">
          <span
            aria-hidden
            className={cn(
              'flex size-9 flex-none items-center justify-center rounded-[10px]',
              CHIP[tone],
            )}
          >
            {ICON[tone]}
          </span>
          <div className="min-w-0 flex-1 self-center">
            <p className="text-[14px] font-bold text-fp-text">
              {tone === 'done'
                ? 'Sync complete'
                : tone === 'failed'
                  ? 'Sync failed'
                  : progressTitle(state, lookbackDays)}
            </p>
            <ToastBody state={state} summary={summary} inbox={inbox} />
            <ToastAction
              state={state}
              summary={summary}
              onRetry={onRetry}
              onDismiss={onDismiss}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="text-fp-text-3"
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}

function ToastBody({
  state,
  summary,
  inbox,
}: Pick<Props, 'state' | 'summary' | 'inbox'>) {
  const line =
    summary?.line ??
    (state.status === 'failed' || state.status === 'busy' ? (
      state.message
    ) : (
      <bdi>{inbox}</bdi>
    ))
  return (
    <>
      <p className="text-[12.5px] leading-relaxed text-fp-text-2">{line}</p>
      {summary?.note ? (
        <p className="text-[12.5px] leading-relaxed text-fp-warn">
          {summary.note}
        </p>
      ) : null}
    </>
  )
}

function ToastAction({
  state,
  summary,
  onRetry,
  onDismiss,
}: Pick<Props, 'state' | 'summary' | 'onRetry' | 'onDismiss'>) {
  const actionClass =
    'mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold text-fp-accent-ink underline-offset-2 hover:underline'
  if (state.status === 'failed') {
    return (
      <button type="button" onClick={onRetry} className={actionClass}>
        Try again
      </button>
    )
  }
  if (summary && summary.reviewCount > 0) {
    return (
      <Link
        to="/transactions"
        search={{ review: true }}
        onClick={onDismiss}
        className={actionClass}
      >
        Review {summary.reviewCount} now
        <ArrowRight size={13} strokeWidth={2.2} className="rtl:rotate-180" />
      </Link>
    )
  }
  return null
}
