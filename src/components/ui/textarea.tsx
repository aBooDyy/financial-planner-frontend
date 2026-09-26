import * as React from 'react'

import { cn } from '@/lib/utils'
import { FIELD_WELL } from './field-well'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        FIELD_WELL,
        'flex field-sizing-content min-h-16 w-full',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
