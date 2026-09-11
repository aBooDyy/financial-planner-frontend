import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Checkbox as UICheckbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

type Props = ComponentProps<typeof UICheckbox> & { children: ReactNode }

/**
 * Labeled checkbox. Wraps the shadcn (Radix) Checkbox, so consumers drive it with
 * `checked` / `onCheckedChange` (e.g. via react-hook-form `Controller`).
 */
export function Checkbox({ children, id, className, ...rest }: Props) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <div className="flex items-start gap-2.5">
      <UICheckbox
        id={checkboxId}
        className={cn('mt-px', className)}
        {...rest}
      />
      <Label
        htmlFor={checkboxId}
        className="cursor-pointer text-[13.5px] leading-snug font-normal text-fp-text-2"
      >
        {children}
      </Label>
    </div>
  )
}
