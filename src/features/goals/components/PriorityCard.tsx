import { STATUS_COLORS } from '#/features/goals/constants'
import type { PriorityRow } from '#/features/goals/data/selectors'
import { SURFACE_CARD } from './styles'

type Props = {
  rows: PriorityRow[]
  note: string
  selectedId: string | null
  onOpen: (goalId: string) => void
}

/** The plan as a ranked list: what the user put first, and how far each one has got. */
export function PriorityCard({ rows, note, selectedId, onOpen }: Props) {
  return (
    <div className={`px-4 py-[15px] ${SURFACE_CARD}`}>
      <div className="mb-3 flex items-center justify-between gap-[10px]">
        <span className="text-[13.5px] font-bold whitespace-nowrap">
          Funded in priority order
        </span>
        <span className="min-w-0 truncate text-[11.5px] text-fp-text-3">
          {note}
        </span>
      </div>

      <div className="flex flex-col gap-px">
        {rows.map((row) => {
          const color = STATUS_COLORS[row.status].main
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpen(row.id)}
              aria-pressed={row.id === selectedId}
              className={`-mx-2 flex items-center gap-[10px] rounded-[9px] px-2 py-2 text-start ${
                row.id === selectedId
                  ? 'bg-fp-accent-soft'
                  : 'hover:bg-fp-surface-2'
              }`}
            >
              <span className="w-4 flex-none text-end text-[11px] font-extrabold text-fp-text-3 tabular-nums">
                {row.num}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{row.name}</span>
                {row.note ? (
                  <span
                    className="mt-px block truncate text-[11px] font-semibold"
                    style={{ color }}
                  >
                    {row.note}
                  </span>
                ) : null}
              </span>
              <span className="hidden h-[6px] w-[84px] flex-none overflow-hidden rounded-[4px] bg-fp-surface-2 min-[900px]:block">
                <span
                  className="block h-full rounded-[4px]"
                  style={{ width: `${row.pct}%`, background: color }}
                />
              </span>
              <span
                className="min-w-[68px] flex-none text-end text-[12.5px] font-bold whitespace-nowrap tabular-nums"
                style={row.status === 'green' ? undefined : { color }}
              >
                {row.amountStr}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
