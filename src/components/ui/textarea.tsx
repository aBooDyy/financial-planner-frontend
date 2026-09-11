import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-fp-surface-2 px-[13px] py-3 text-[14.5px] text-fp-text transition outline-none placeholder:text-fp-text-3 focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-fp-danger aria-invalid:ring-fp-danger/20',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
