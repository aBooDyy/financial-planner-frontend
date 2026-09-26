import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type Props = {
  step: number
  title: string
  /** The step is answered; its number turns solid. */
  done?: boolean
  /** A short status or action beside the title — "Learned", "Change". */
  aside?: ReactNode
  children: ReactNode
}

/** One numbered step of the rule editor. */
export function EditorSection({
  step,
  title,
  done = false,
  aside,
  children,
}: Props) {
  const id = `rule-step-${step}`
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-[10px]">
        <span
          aria-hidden
          className={cn(
            'flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold',
            done ? 'bg-fp-accent text-white' : 'bg-fp-surface-2 text-fp-text-2',
          )}
        >
          {step}
        </span>
        <h3 id={id} className="flex-1 text-[15px] font-extrabold">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
