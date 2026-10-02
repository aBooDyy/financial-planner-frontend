import { CalendarDays, Check, TriangleAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { VerdictCopy } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'

const TILE: Record<VerdictCopy['tone'], string> = {
  ok: 'bg-fp-accent-soft text-fp-accent-ink',
  warn: 'bg-fp-warn/12 text-fp-warn',
  danger: 'bg-fp-surface text-fp-danger',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

/** "Am I ready?" in one card: the verdict, why, and the next thing to do. */
export function VerdictCard({
  copy,
  onAction,
}: {
  copy: VerdictCopy
  onAction: () => void
}) {
  const Icon =
    copy.tone === 'ok'
      ? Check
      : copy.tone === 'neutral'
        ? CalendarDays
        : TriangleAlert
  const danger = copy.tone === 'danger'
  return (
    <section
      aria-label="Verdict"
      className={cn(
        'flex flex-col gap-3 rounded-[18px] border px-4 py-4 md:flex-row md:items-center md:px-5 md:py-[18px]',
        danger
          ? 'border-fp-danger/30 bg-fp-danger/10'
          : 'border-fp-border bg-fp-surface shadow-fp',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-[38px] flex-none items-center justify-center rounded-[12px]',
            TILE[copy.tone],
          )}
        >
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2
            className={cn(
              'text-[18px] leading-[1.25] font-extrabold tracking-[-0.015em] md:text-[20px]',
              danger && 'text-fp-danger',
            )}
          >
            <span className="fp-sensitive">{copy.title}</span>
          </h2>
          <p className="fp-sensitive mt-1 max-w-[64ch] text-[13.5px] leading-[1.5] text-fp-text-2">
            {copy.sub}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant={copy.action.primary ? 'default' : 'quiet'}
        onClick={onAction}
        className="flex-none self-start rounded-[11px] px-[15px] py-[9px] text-[13px] md:self-center"
      >
        {copy.action.label}
      </Button>
    </section>
  )
}
