import type { ComponentProps } from 'react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

/** The compact action inside a dialog's body ("Add rule", "Try again", "Find their emails"). */
export function SmallButton({
  className,
  variant = 'quiet',
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      className={cn(
        'h-auto gap-1.5 rounded-[11px] px-3 py-2 text-[13px] font-bold has-[>svg]:px-3',
        className,
      )}
      {...props}
    />
  )
}
