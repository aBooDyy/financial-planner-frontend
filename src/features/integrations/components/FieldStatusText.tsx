import { Check, Circle, X } from 'lucide-react'
import { cn } from '#/lib/utils'
import type {
  StatusLine,
  StatusTone,
} from '#/features/integrations/data/fieldStatus'

const TONE: Record<StatusTone, string> = {
  ok: 'text-fp-accent-ink',
  error: 'text-fp-danger',
  idle: 'text-fp-text-3',
}

const ICON: Record<StatusTone, typeof Check> = {
  ok: Check,
  error: X,
  idle: Circle,
}

/** What a field resolved to in the sample — its colour is never the only signal. */
export function FieldStatusText({
  id,
  status,
}: {
  id: string
  status: StatusLine
}) {
  const Icon = ICON[status.tone]
  return (
    <p
      id={id}
      className={cn(
        'flex items-start gap-1.5 text-[12.5px]',
        TONE[status.tone],
      )}
    >
      <Icon
        aria-hidden
        size={status.tone === 'idle' ? 10 : 14}
        strokeWidth={2.4}
        className={cn(
          'shrink-0',
          status.tone === 'idle' ? 'mt-[5px]' : 'mt-[2px]',
        )}
      />
      <span className="min-w-0 break-words">
        {status.lead}
        {status.value !== undefined ? (
          <bdi className="font-semibold">{status.value}</bdi>
        ) : null}
        {status.tail}
      </span>
    </p>
  )
}
