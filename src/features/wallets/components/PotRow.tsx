import { ChevronRight } from 'lucide-react'
import type { ReservationRow } from '#/features/wallets/data/selectors'

type Props = {
  pot: ReservationRow
  depth: number
  last: boolean
  onOpen: (goalId: string) => void
}

/** What one goal holds in a wallet. Tapping it opens the goal. */
export function PotRow({ pot, depth, last, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(pot.goalId)}
      aria-label={`Open ${pot.goalName}, ${pot.amountStr} set aside`}
      className={`flex w-full items-center gap-[9px] pe-[10px] ps-[45px] text-start hover:bg-fp-surface-2 sm:pe-[14px] sm:ps-[60px] ${
        last ? 'pt-[5px] pb-[10px]' : 'py-[5px]'
      }`}
    >
      <span style={{ marginInlineStart: depth * 20 }} className="shrink-0" />
      <span
        className="h-[10px] w-[10px] shrink-0 rounded-[3px] ring-1 ring-black/10"
        style={{ background: pot.color }}
      />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-fp-text-2">
        {pot.goalName}
      </span>
      <span className="fp-sensitive shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-fp-text-2 tabular-nums">
        {pot.amountStr}
      </span>
      <ChevronRight
        size={13}
        strokeWidth={2.2}
        className="shrink-0 text-fp-text-3 rtl:rotate-180"
      />
    </button>
  )
}
