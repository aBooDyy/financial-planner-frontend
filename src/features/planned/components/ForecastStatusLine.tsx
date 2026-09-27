import { CircleCheck, TriangleAlert } from 'lucide-react'
import type { ForecastStatus } from '#/features/planned/data/forecast'
import { cn } from '#/lib/utils'

const TONE: Record<ForecastStatus['kind'], string> = {
  short: 'text-fp-danger',
  reserved: 'text-fp-warn',
  clear: 'text-fp-accent-ink',
}

export function ForecastStatusLine({ status }: { status: ForecastStatus }) {
  const Icon = status.kind === 'clear' ? CircleCheck : TriangleAlert
  return (
    <div
      className={cn(
        'flex items-center gap-[6px] text-[12px] font-semibold',
        TONE[status.kind],
      )}
    >
      <Icon aria-hidden size={13} strokeWidth={2.4} />
      {status.text}
    </div>
  )
}
