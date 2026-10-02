import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '#/lib/utils'

/** "More options ▾": the optional fields, folded away until asked for. */
export function MoreOptions({
  children,
  defaultOpen = false,
}: {
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 self-start text-[13.5px] font-bold text-fp-accent-ink"
      >
        More options
        <ChevronDown
          size={15}
          aria-hidden
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? children : null}
    </div>
  )
}
