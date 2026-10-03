import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/** The Planning page's card: surface, hairline, radius 16, the app shadow. */
export function PlanCard({
  className,
  children,
  label,
}: {
  className?: string
  children: ReactNode
  /** Names the card for assistive tech when it has no visible heading. */
  label?: string
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'min-w-0 rounded-[16px] border border-fp-border bg-fp-surface shadow-fp',
        className,
      )}
    >
      {children}
    </section>
  )
}

/** A card's title row: the title, then a quiet note or a control at its end. */
export function CardHeader({
  title,
  note,
  end,
  className,
}: {
  title: ReactNode
  note?: ReactNode
  end?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 px-[18px] pt-4 pb-3',
        className,
      )}
    >
      <h2 className="flex-none text-[15px] font-extrabold tracking-[-0.01em] text-fp-text">
        {title}
      </h2>
      {note ? (
        <span className="ms-auto min-w-0 truncate text-[12px] text-fp-text-3">
          {note}
        </span>
      ) : null}
      {end ? <div className="ms-auto flex-none">{end}</div> : null}
    </div>
  )
}
