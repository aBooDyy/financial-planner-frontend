import { TriangleAlert } from 'lucide-react'
import type { ComingUpAlert } from '#/features/wallets/data/comingUp'
import { cn } from '#/lib/utils'

export function ComingUpAlertLine({ alert }: { alert: ComingUpAlert }) {
  return (
    <div
      className={cn(
        'flex items-center gap-[6px] text-[12px] font-semibold',
        alert.kind === 'short' ? 'text-fp-danger' : 'text-fp-warn',
      )}
    >
      <TriangleAlert aria-hidden size={13} strokeWidth={2.4} />
      {alert.text}
    </div>
  )
}
