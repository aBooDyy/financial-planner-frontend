import { ChevronRight } from 'lucide-react'
import type {
  BalanceRow,
  SetAsideLineRow,
} from '#/features/wallets/data/selectors'
import { cn } from '#/lib/utils'

type Props = {
  row: BalanceRow
  expanded: boolean
  onToggle: () => void
  onOpen: (line: SetAsideLineRow) => void
}

const SUMMARY_NAMED = 2

/**
 * What a wallet holds set aside: folded, one line naming the largest ("Rent SR 3,000.00 · Car
 * insurance SR 800.00 · +1"); open, one line per bill or goal — its colour, name and amount —
 * each opening it on Planning.
 */
export function SetAsideLines({ row, expanded, onToggle, onOpen }: Props) {
  const lines = row.setAsideLines
  const more = lines.length - SUMMARY_NAMED
  const indent = { marginInlineStart: row.depth * 20 }
  return (
    <div className="pb-[8px]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-[6px] pe-[10px] ps-[45px] text-start text-[12px] text-fp-text-2 hover:text-fp-text sm:pe-[14px] sm:ps-[60px]"
      >
        <span style={indent} className="shrink-0" />
        <ChevronRight
          size={13}
          strokeWidth={2.4}
          aria-hidden
          className={cn(
            'shrink-0 text-fp-text-3 transition-transform',
            expanded ? 'rotate-90' : 'rtl:-scale-x-100',
          )}
        />
        <span className="fp-sensitive min-w-0 flex-1 truncate">
          {expanded
            ? `Set aside in ${row.name}`
            : [
                ...lines
                  .slice(0, SUMMARY_NAMED)
                  .map((l) => `${l.ownerName} ${l.amountStr}`),
                ...(more > 0 ? [`+${more}`] : []),
              ].join(' · ')}
        </span>
      </button>
      {expanded ? (
        <ul className="mt-[4px]">
          {lines.map((line) => (
            <li key={line.ownerId}>
              <button
                type="button"
                onClick={() => onOpen(line)}
                aria-label={`Open ${line.ownerName}, ${line.amountStr} set aside`}
                className="flex w-full items-center gap-[9px] py-[5px] pe-[10px] ps-[64px] text-start hover:bg-fp-surface-2 sm:pe-[14px] sm:ps-[79px]"
              >
                <span style={indent} className="shrink-0" />
                <span
                  className="h-[10px] w-[10px] shrink-0 rounded-[3px] ring-1 ring-black/10"
                  style={{ background: line.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fp-text-2">
                  {line.ownerName}
                </span>
                <span className="fp-sensitive shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-fp-text-2 tabular-nums">
                  {line.amountStr}
                </span>
                <ChevronRight
                  size={13}
                  strokeWidth={2.2}
                  aria-hidden
                  className="shrink-0 text-fp-text-3 rtl:rotate-180"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
