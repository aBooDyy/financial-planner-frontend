import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useManualScan } from '#/features/email-sync/hooks/useManualScan'
import { useConfigLimits } from '#/lib/config/appConfig'

/** Sentinel for "resume from the cursor" — Radix forbids an empty Select value. */
const SINCE_LAST = 'since'

/** Offered windows, trimmed to the server's `email_sync_max_lookback_days` at render. */
const WINDOW_DAYS = [7, 30, 90, 180]

/** The compact variant has no picker, so it names its own window to stay a manual scan. */
const COMPACT_LOOKBACK_DAYS = 30

const WIDE_WINDOW_DAYS = 90

type Props = {
  /** Scope the scan to one inbox. Omitted scans every connected inbox. */
  connectionId?: string
  /** Button-only variant for tight headers: no window picker, no review link. */
  compact?: boolean
  label?: string
  className?: string
}

export function ScanNowControl({
  connectionId,
  compact = false,
  label = 'Scan now',
  className,
}: Props) {
  const { state, summary, scan, reset } = useManualScan()
  const [chosenWindow, setChosenWindow] = useState(SINCE_LAST)
  const maxLookbackDays = useConfigLimits().emailSyncMaxLookbackDays
  const windows = [
    { value: SINCE_LAST, label: 'Since last scan' },
    ...WINDOW_DAYS.filter((d) => d <= maxLookbackDays).map((d) => ({
      value: String(d),
      label: `Last ${d} days`,
    })),
  ]

  // `busy` means the server is already scanning this inbox — the button stays disabled and
  // says so, because the work the user asked for is happening.
  const scanning = state.status === 'scanning' || state.status === 'busy'
  const lookbackDays = compact
    ? Math.min(COMPACT_LOOKBACK_DAYS, maxLookbackDays)
    : chosenWindow === SINCE_LAST
      ? undefined
      : Number(chosenWindow)

  const run = () => void scan({ connectionId, lookbackDays })

  const changeWindow = (value: string) => {
    setChosenWindow(value)
    reset()
  }

  const button = (
    <Button
      type="button"
      onClick={run}
      disabled={scanning}
      className="shrink-0 px-[15px] py-[10px] text-[13.5px]"
    >
      {scanning ? (
        <Loader2 size={15} strokeWidth={2} className="animate-spin" />
      ) : (
        <RefreshCw size={15} strokeWidth={2} />
      )}
      {scanning ? 'Scanning…' : label}
    </Button>
  )

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        {compact ? null : (
          <Select
            value={chosenWindow}
            onValueChange={changeWindow}
            disabled={scanning}
          >
            <SelectTrigger
              aria-label="How far back to scan"
              className="w-auto min-w-[168px] px-[13px] py-[10px] text-[13.5px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {windows.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {button}
      </div>

      {!compact &&
      lookbackDays !== undefined &&
      lookbackDays >= WIDE_WINDOW_DAYS ? (
        <p className="text-[12px] leading-relaxed text-fp-text-3">
          Alerts you already dismissed stay dismissed.
        </p>
      ) : null}

      <div
        aria-live="polite"
        className="min-w-0 text-[12.5px] leading-relaxed text-fp-text-2"
      >
        {state.status === 'scanning' ? <span>Scanning your inbox…</span> : null}
        {state.status === 'busy' ? <span>{state.message}</span> : null}

        {summary ? (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>{summary.line}</span>
            {summary.note ? (
              <span className="text-fp-danger">{summary.note}</span>
            ) : null}
            {!compact && summary.reviewCount > 0 ? (
              <Link
                to="/transactions"
                search={{ review: true }}
                className="inline-flex items-center gap-1 font-semibold text-fp-accent-ink underline-offset-2 hover:underline"
              >
                Review now
                <ArrowRight size={13} strokeWidth={2.2} />
              </Link>
            ) : null}
          </span>
        ) : null}
      </div>

      {state.status === 'failed' ? (
        <Alert
          variant="destructive"
          className="items-start gap-[9px] rounded-xl border-fp-danger/40 bg-fp-danger/5 px-[13px] py-[10px]"
        >
          <AlertTriangle size={15} strokeWidth={1.9} className="mt-px" />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold text-fp-danger">
            <span>{state.message}</span>
            <button
              type="button"
              onClick={run}
              className="font-bold underline underline-offset-2"
            >
              Try again
            </button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
