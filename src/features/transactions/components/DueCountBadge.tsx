import { cn } from '#/lib/utils'

type Props = {
  count: number
  className?: string
}

/** The amber count of planned items waiting to be confirmed. */
export function DueCountBadge({ count, className }: Props) {
  return (
    <span
      aria-label={`${count} need confirming`}
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fp-warn px-[5px] text-[10.5px] font-bold text-white tabular-nums',
        className,
      )}
    >
      {count}
    </span>
  )
}
