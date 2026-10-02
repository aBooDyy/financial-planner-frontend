import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '#/lib/utils'

/** The blue "what this will do" line in an editor or sheet. */
export function InfoLine({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-[9px] rounded-[14px] bg-fp-transfer-soft px-[13px] py-[11px] text-[13.5px] leading-[1.45] font-semibold text-fp-text',
        className,
      )}
    >
      <Info
        aria-hidden
        size={16}
        strokeWidth={2}
        className="mt-px flex-none text-fp-transfer"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
