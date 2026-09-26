import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '#/lib/utils'
import type {
  ScanState,
  ScanSummary,
} from '#/features/email-sync/hooks/useManualScan'

type Props = {
  state: ScanState
  summary: ScanSummary | null
  onRetry: () => void
  /** Offer a way into the review queue when the sync left something waiting. */
  reviewLink?: boolean
  /** A tinted box around the line, only while it says something. */
  boxed?: boolean
}

/** What the last sync found, said in one line — including when nothing was new. */
export function ScanResultLine({
  state,
  summary,
  onRetry,
  reviewLink = true,
  boxed = false,
}: Props) {
  const saying =
    summary !== null || state.status === 'busy' || state.status === 'failed'
  return (
    <div
      aria-live="polite"
      className={cn(
        'min-w-0 text-[12.5px] leading-relaxed text-fp-text-2',
        boxed &&
          saying &&
          'rounded-[12px] bg-fp-surface-2 px-[13px] py-[11px] font-medium',
      )}
    >
      {state.status === 'busy' ? <span>{state.message}</span> : null}

      {summary ? (
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{summary.line}</span>
          {summary.note ? (
            <span className="text-fp-warn">{summary.note}</span>
          ) : null}
          {reviewLink && summary.reviewCount > 0 ? (
            <Link
              to="/transactions"
              search={{ review: true }}
              className={cn(
                'inline-flex items-center gap-1 font-bold text-fp-accent-ink underline-offset-2 hover:underline',
                boxed && 'ms-auto',
              )}
            >
              Review now
              <ArrowRight
                size={13}
                strokeWidth={2.2}
                className="rtl:rotate-180"
              />
            </Link>
          ) : null}
        </span>
      ) : null}

      {state.status === 'failed' ? (
        <span
          role="alert"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-fp-danger"
        >
          <AlertTriangle size={14} strokeWidth={2} className="shrink-0" />
          <span>{state.message}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-bold underline underline-offset-2"
          >
            Try again
          </button>
        </span>
      ) : null}
    </div>
  )
}
