'use client'

import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border-none p-[3px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-fp-accent data-[state=unchecked]:bg-fp-border-strong',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] ring-0 transition-transform data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[18px] rtl:data-[state=checked]:-translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
