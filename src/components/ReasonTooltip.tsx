import { useState } from 'react'
import type { ReactElement } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

type Props = {
  /** Why the control is off; `null` renders the child alone. */
  reason: string | null
  /** One element that takes a ref and pointer handlers — not a disabled `<button>`, which gets no events. */
  children: ReactElement
}

/**
 * Says why a control can't be used, on hover or focus and — since touch has no hover — on a
 * tap too.
 */
export function ReasonTooltip({ reason, children }: Props) {
  const [open, setOpen] = useState(false)
  if (reason === null) return children
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-[260px] px-3 py-2">
        {reason}
      </TooltipContent>
    </Tooltip>
  )
}
