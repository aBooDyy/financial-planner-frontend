import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-auto w-full min-w-0 rounded-xl border border-input bg-fp-surface-2 px-[13px] py-3 text-[14.5px] text-fp-text transition outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-fp-text-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15',
        'aria-invalid:border-fp-danger aria-invalid:ring-fp-danger/20',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
