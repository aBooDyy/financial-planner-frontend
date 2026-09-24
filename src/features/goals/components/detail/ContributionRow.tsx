import type { ContributionRowView } from '#/features/goals/data/goalDetail'
import { ContributionMark } from './ContributionMark'

type Props = {
  row: ContributionRowView
  color: string
  /** Set when tapping the row does something (confirm it, or reveal its actions). */
  onSelect?: () => void
}

/** One line of the contributions list: its mark, date, what it is, and the amount. */
export function ContributionRow({ row, color, onSelect }: Props) {
  const body = (
    <>
      <ContributionMark mark={row.mark} color={color} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{row.dateStr}</span>
        <span
          className={`block truncate text-[11px] ${
            row.mark === 'due'
              ? 'font-bold text-fp-warn'
              : row.mark === 'skipped'
                ? 'text-fp-text-3 line-through'
                : 'text-fp-text-3'
          }`}
        >
          {row.caption}
        </span>
      </span>
      <span
        className={`text-[12.5px] font-bold whitespace-nowrap tabular-nums ${
          row.mark === 'confirmed' ? 'text-fp-text' : 'text-fp-text-3'
        }`}
      >
        {row.amountStr}
      </span>
    </>
  )
  const layout =
    'flex w-full items-center gap-[10px] border-b border-fp-border py-[9px] text-start'

  return onSelect ? (
    <button
      type="button"
      onClick={onSelect}
      className={`${layout} cursor-pointer hover:bg-fp-surface-2`}
    >
      {body}
    </button>
  ) : (
    <div className={layout}>{body}</div>
  )
}
