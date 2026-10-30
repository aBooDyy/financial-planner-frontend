import { cn } from '#/lib/utils'
import { Dot } from '#/features/planning/components/kit/Spine'

/** One choice in a wallet radio group: its name and what it has free. */
export function WalletCard({
  active,
  onClick,
  color,
  name,
  note,
}: {
  active: boolean
  onClick: () => void
  color: string
  name: string
  note: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-[10px] rounded-[14px] border-[1.5px] px-[14px] py-[11px] text-start transition',
        active
          ? 'border-fp-accent bg-fp-accent-soft'
          : 'border-fp-border bg-fp-surface hover:border-fp-border-strong',
      )}
    >
      <Dot color={color} size={10} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-fp-text">
        {name}
      </span>
      <span className="flex-none text-[12.5px] text-fp-text-3 tabular-nums">
        {note}
      </span>
    </button>
  )
}
