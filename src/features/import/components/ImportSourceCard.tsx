import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '#/components/ui/badge'

type Props = {
  icon: LucideIcon
  title: string
  badge?: string
  muted?: boolean
  children: ReactNode
  footer?: ReactNode
}

const CARD =
  'flex flex-col overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

export function ImportSourceCard({
  icon: Icon,
  title,
  badge,
  muted = false,
  children,
  footer,
}: Props) {
  return (
    <section className={`${CARD}${muted ? ' opacity-75' : ''}`}>
      <div className="flex items-center gap-3 px-[18px] pt-[18px]">
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-fp-accent-soft text-fp-accent-ink">
          <Icon size={21} strokeWidth={1.8} />
        </span>
        <h2 className="min-w-0 flex-1 text-[16.5px] font-extrabold tracking-[-0.01em]">
          {title}
        </h2>
        {badge ? (
          <Badge className="shrink-0 bg-fp-surface-2 px-[10px] py-[5px] text-[11.5px] font-semibold text-fp-text-3">
            {badge}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-[18px] py-3.5 text-[13px] leading-relaxed text-fp-text-2">
        {children}
      </div>

      {footer ? (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-fp-border px-[18px] py-[14px]">
          {footer}
        </div>
      ) : null}
    </section>
  )
}
