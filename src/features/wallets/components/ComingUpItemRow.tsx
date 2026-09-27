import type { ComingUpItem } from '#/features/wallets/data/comingUp'
import { cn } from '#/lib/utils'

export function ComingUpItemRow({ item }: { item: ComingUpItem }) {
  return (
    <li className="flex items-baseline gap-2 text-[12.5px]">
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
    </li>
  )
}
