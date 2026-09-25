import { Check } from 'lucide-react'
import { cn } from '#/lib/utils'

type Props = {
  on: boolean
  /** `check` for multi-select cards, `radio` for single-select ones. */
  kind: 'check' | 'radio'
}

/** The round selection indicator in a card's end corner. */
export function SelectMark({ on, kind }: Props) {
  if (kind === 'radio') {
    return (
      <span
        aria-hidden
        className={cn(
          'flex size-5 flex-none items-center justify-center rounded-full border-[1.5px]',
          on ? 'border-fp-accent' : 'border-fp-border-strong',
        )}
      >
        <span className={cn('size-2.5 rounded-full', on && 'bg-fp-accent')} />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full border-[1.5px] text-white',
        on
          ? 'border-fp-accent bg-fp-accent'
          : 'border-fp-border-strong bg-transparent',
      )}
    >
      {on && <Check size={13} strokeWidth={3} />}
    </span>
  )
}
