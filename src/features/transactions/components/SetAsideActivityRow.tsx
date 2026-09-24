import { PiggyBank } from 'lucide-react'
import type { SetAsideRow } from '#/features/transactions/data/selectors'
import { TagPill } from '#/components/TagPill'

/** A goal reservation in the activity list — held, not spent, so never in the day's totals. */
export function SetAsideActivityRow({
  row,
  onClick,
}: {
  row: SetAsideRow
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b border-fp-border px-4 py-[11px] hover:bg-fp-surface-2"
    >
      <div className="flex size-9 flex-none items-center justify-center rounded-[11px] border border-dashed border-fp-border-strong bg-fp-surface-2 text-fp-text-2">
        <PiggyBank size={17} strokeWidth={1.9} />
      </div>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[14px] font-semibold">{row.name}</span>
        <span className="flex min-w-0 items-center gap-[6px] text-[12px] text-fp-text-3">
          <TagPill label="Goal" tone="accent" />
          <span className="flex-none">Set aside</span>
          <span className="h-[3px] w-[3px] flex-none rounded-full bg-fp-border-strong" />
          <span
            className="h-[7px] w-[7px] flex-none rounded-[2px]"
            style={{ background: row.sourceColor }}
          />
          <span className="truncate">{row.sourceName}</span>
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex flex-none flex-col items-end text-end">
        <span className="whitespace-nowrap text-[14px] font-bold tabular-nums text-fp-text-2">
          {row.amountStr}
        </span>
        <span className="text-[10.5px] font-semibold text-fp-text-3">
          not in totals
        </span>
      </div>
    </div>
  )
}
