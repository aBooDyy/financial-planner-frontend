import { CalendarDays, Check, TriangleAlert } from 'lucide-react'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import type { VerdictCopy } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'

const TILE: Record<VerdictCopy['tone'], string> = {
  ok: 'bg-fp-accent-soft text-fp-accent-ink',
  warn: 'bg-fp-warn-soft text-fp-warn',
  danger: 'bg-fp-surface text-fp-danger',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

/** "Am I ready?" in one card: the verdict, why, and the next thing to do. `null` while loading. */
export function VerdictCard({
  copy,
  onAction,
}: {
  copy: VerdictCopy | null
  onAction: () => void
}) {
  const tone = copy?.tone ?? 'neutral'
  const Icon =
    tone === 'ok' ? Check : tone === 'neutral' ? CalendarDays : TriangleAlert
  const danger = tone === 'danger'
  return (
    <section
      aria-label="Verdict"
      className={cn(
        'rounded-[18px] border px-4 py-4 md:px-5 md:py-[18px]',
        danger
          ? 'border-fp-danger-line bg-fp-danger-soft'
          : 'border-fp-border bg-fp-surface shadow-fp',
      )}
    >
      <div className="flex items-start gap-[13px]">
        {copy ? (
          <span
            aria-hidden
            className={cn(
              'flex size-[38px] flex-none items-center justify-center rounded-[12px]',
              TILE[tone],
            )}
          >
            <Icon size={19} strokeWidth={2.2} />
          </span>
        ) : (
          <Skeleton
            aria-hidden
            className="size-[38px] flex-none rounded-[12px]"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              'text-[18px] leading-[1.25] font-extrabold tracking-[-0.015em] md:text-[20px]',
              danger && 'text-fp-danger',
            )}
          >
            <span className="fp-sensitive">
              <ValueOrSkeleton value={copy?.title} className="h-5 w-64" />
            </span>
          </h2>
          {copy ? (
            <p className="fp-sensitive mt-1 max-w-[64ch] text-[13.5px] leading-[1.5] text-fp-text-2">
              {copy.sub}
            </p>
          ) : (
            <div aria-hidden className="mt-2 flex max-w-[64ch] flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/5" />
            </div>
          )}
          <div className="mt-[14px] flex flex-wrap gap-2">
            {copy ? (
              <Button
                type="button"
                variant={copy.action.primary ? 'default' : 'quiet'}
                onClick={onAction}
                className="rounded-[11px] px-[15px] py-[9px] text-[13px]"
              >
                {copy.action.label}
              </Button>
            ) : (
              <Skeleton aria-hidden className="h-9 w-36 rounded-[11px]" />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
