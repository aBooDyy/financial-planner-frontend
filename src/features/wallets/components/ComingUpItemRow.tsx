import { Link } from '@tanstack/react-router'
import type { ComingUpItem } from '#/features/wallets/data/comingUp'
import { cn } from '#/lib/utils'

/** One bill or payday; it opens on Planning › Upcoming. */
export function ComingUpItemRow({ item }: { item: ComingUpItem }) {
  return (
    <li>
      <Link
        to="/planning/$section"
        params={{ section: 'upcoming' }}
        search={{ open: `planned:${item.id}` }}
        className="flex items-baseline gap-2 rounded-[6px] text-[12.5px] hover:bg-fp-surface-2"
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-fp-text">{item.name}</span>
          <span className="text-fp-text-3"> · {item.whenStr}</span>
        </span>
        <span
          className={cn(
            'fp-sensitive shrink-0 font-semibold whitespace-nowrap tabular-nums',
            item.direction === 'in' ? 'text-fp-accent-ink' : 'text-fp-text-2',
          )}
        >
          {item.amountStr}
        </span>
      </Link>
    </li>
  )
}
