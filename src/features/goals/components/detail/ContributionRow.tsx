import type { ContributionRowView } from '#/features/goals/data/goalDetail'
import { cn } from '#/lib/utils'
import { ContributionMark } from './ContributionMark'

type Props = {
  row: ContributionRowView
  color: string
  /** Set when tapping the row does something (confirm it, or reveal its actions). */
  onSelect?: () => void
}

const LAYOUT =
  'flex w-full items-center gap-[10px] border-t border-fp-border py-[10px] text-start'

/** One line of the contributions list: its mark, date, what it is, and the amount. */
export function ContributionRow({ row, color, onSelect }: Props) {
  const body = (
    <>
      <ContributionMark mark={row.mark} color={color} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-fp-text">
          {row.dateStr}
        </span>
        <span
          className={cn(
            'block truncate text-[12px] text-fp-text-3',
            row.mark === 'skipped' && 'line-through',
          )}
        >
          {row.caption}
        </span>
      </span>
      <span
        className={cn(
          'text-[13.5px] font-bold whitespace-nowrap tabular-nums',
          row.mark === 'skipped' ? 'text-fp-text-3' : 'text-fp-text',
        )}
      >
        {row.amountStr}
      </span>
    </>
  )

  return onSelect ? (
    <button
      type="button"
      onClick={onSelect}
      className={cn(LAYOUT, 'cursor-pointer hover:bg-fp-surface-2')}
    >
      {body}
    </button>
  ) : (
    <div className={LAYOUT}>{body}</div>
  )
}
