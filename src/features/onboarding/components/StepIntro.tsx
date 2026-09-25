import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  className?: string
}

/** Every step opens the same way: an accent eyebrow, a large title, a short explanation. */
export function StepIntro({ eyebrow, title, children, className }: Props) {
  return (
    <div className={className}>
      <div className="text-[13px] font-bold tracking-[0.04em] text-fp-accent-ink uppercase">
        {eyebrow}
      </div>
      <h1 className="mt-2.5 text-[26px] leading-[1.12] font-extrabold tracking-[-0.024em] text-balance md:text-[32px]">
        {title}
      </h1>
      {children && (
        <p
          className={cn(
            'mt-3 max-w-[520px] text-[15px] leading-[1.55] text-pretty text-fp-text-2',
          )}
        >
          {children}
        </p>
      )}
    </div>
  )
}
