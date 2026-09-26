import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export type NoteTone = 'accent' | 'warn' | 'danger' | 'neutral'

const TONE: Record<NoteTone, string> = {
  accent: 'bg-fp-accent-soft text-fp-accent-ink',
  warn: 'bg-fp-spend-soft text-fp-spend',
  danger: 'bg-fp-danger/10 text-fp-danger',
  neutral: 'bg-fp-surface-2 text-fp-text-2',
}

type Props = {
  tone?: NoteTone
  icon?: ReactNode
  className?: string
  children: ReactNode
}

/** A tinted line of consequence ("Settles the planned Sep 1 set-aside…"). */
export function NoteBox({ tone = 'accent', icon, className, children }: Props) {
  return (
    <div
      className={cn(
        'flex items-start gap-[9px] rounded-[12px] px-[13px] py-[11px] text-[12.5px] leading-[1.5] font-semibold text-pretty',
        TONE[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="mt-px flex flex-none [&_svg]:size-[15px]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
