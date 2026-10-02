import { Link2 } from 'lucide-react'
import { Switch } from '#/components/ui/switch'
import type { LinkBanner } from '#/features/transactions/hooks/useCountsToward'
import { cn } from '#/lib/utils'

type Props = {
  banner: LinkBanner
  onLinked: (linked: boolean) => void
  /** Offered when an income entry's payday was found for it rather than picked. */
  onChooseStream?: () => void
}

/** The planned bill or payday this entry settles, with the switch that keeps it apart. */
export function PlannedLinkBanner({ banner, onLinked, onChooseStream }: Props) {
  const on = banner.linked
  return (
    <div
      className={cn(
        'flex items-start gap-[10px] rounded-[12px] px-3 py-[11px]',
        on ? 'bg-fp-accent-soft' : 'bg-fp-surface-2',
      )}
    >
      <span
        className={cn(
          'flex size-[26px] flex-none items-center justify-center rounded-[8px] text-white',
          on ? 'bg-fp-accent' : 'bg-fp-border-strong',
        )}
      >
        <Link2 size={14} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[13.5px] font-bold',
            on ? 'text-fp-accent-ink' : 'text-fp-text-2 line-through',
          )}
        >
          {banner.text}
        </span>
        <span className="mt-[2px] block text-[12px] leading-[1.45] text-fp-text-2">
          {banner.sub}
        </span>
        {onChooseStream ? (
          <button
            type="button"
            onClick={onChooseStream}
            className="mt-[5px] p-0 text-[12px] font-bold text-fp-accent-ink"
          >
            Choose another stream
          </button>
        ) : null}
      </span>
      <label className="flex flex-none items-center gap-[7px] pt-[3px] text-[12px] font-bold text-fp-text-2">
        Link
        <Switch
          checked={on}
          onCheckedChange={onLinked}
          aria-label="Link to the upcoming item"
        />
      </label>
    </div>
  )
}
