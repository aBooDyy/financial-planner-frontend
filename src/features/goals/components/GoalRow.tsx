import { STATUS_COLORS } from '#/features/goals/constants'
import type { GoalCard } from '#/features/goals/data/selectors'
import { ListRow } from './ListRow'

type Props = {
  card: GoalCard
  selected: boolean
  onSelect: (id: string) => void
}

export function GoalRow({ card, selected, onSelect }: Props) {
  const status = STATUS_COLORS[card.status]
  const flagged = card.status !== 'green'
  const amountColor = card.isOver
    ? status.main
    : card.isDeferred
      ? 'var(--fp-text-3)'
      : undefined

  return (
    <ListRow
      color={card.color}
      selected={selected}
      onSelect={() => onSelect(card.id)}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">
          {card.name}
        </span>
        <span
          className={`block truncate text-[11px] ${flagged ? 'font-semibold' : 'text-fp-text-3'}`}
          style={flagged ? { color: status.main } : undefined}
        >
          {card.rowMeta}
        </span>
      </span>

      <span className="hidden h-[5px] w-[52px] flex-none overflow-hidden rounded-[3px] bg-fp-surface-2 min-[900px]:block">
        <span
          className="block h-full rounded-[3px]"
          style={{ width: `${card.fundedPct}%`, background: status.main }}
        />
      </span>

      <span className="flex min-w-[70px] flex-none flex-col items-end">
        <span
          className="text-[13px] font-bold whitespace-nowrap tabular-nums"
          style={amountColor ? { color: amountColor } : undefined}
        >
          {card.monthlyStr}
        </span>
        {card.monthlySubStr ? (
          <span className="text-[10px] font-semibold whitespace-nowrap text-fp-text-3">
            {card.monthlySubStr}
          </span>
        ) : null}
      </span>
    </ListRow>
  )
}
