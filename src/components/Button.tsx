import type { ButtonHTMLAttributes } from 'react'
import { Button as UIButton } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type Variant = 'primary' | 'secondary'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

// The app's full-width form CTA, layered on the shadcn Button so behavior/a11y come
// from the primitive while the Means look (sizing, accent shadow) stays intact.
const VARIANTS: Record<Variant, string> = {
  primary:
    'w-full gap-2.5 px-3 py-[13px] text-[15px] shadow-[0_6px_16px_-6px_var(--fp-accent)]',
  secondary:
    'w-full gap-2.5 bg-fp-surface px-3 py-3 text-[14.5px] font-semibold',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...rest
}: Props) {
  return (
    <UIButton
      type={type}
      variant={variant === 'primary' ? 'default' : 'outline'}
      className={cn(VARIANTS[variant], className)}
      {...rest}
    />
  )
}
