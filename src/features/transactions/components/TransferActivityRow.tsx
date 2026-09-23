import { ArrowRight } from 'lucide-react'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import type { TransferRow } from '#/features/transactions/data/selectors'

function WalletTag({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-[5px]">
      <span
        className="h-[7px] w-[7px] flex-none rounded-[2px]"
        style={{ background: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** One transfer in the activity list — neutral, never counted in the day's totals. */
export function TransferActivityRow({
  row,
  onClick,
}: {
  row: TransferRow
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b border-fp-border px-4 py-[11px] hover:bg-fp-surface-2"
    >
      <div className="flex size-9 flex-none items-center justify-center rounded-[11px] border border-dashed border-fp-border-strong bg-fp-surface-2 text-fp-text-2">
        <TransferGlyph size={17} strokeWidth={1.9} />
      </div>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[14px] font-semibold">{row.name}</span>
        <span className="flex min-w-0 items-center gap-[6px] text-[12px] text-fp-text-3">
          <WalletTag name={row.fromName} color={row.fromColor} />
          <ArrowRight
            size={12}
            strokeWidth={2}
            className="flex-none rtl:-scale-x-100"
          />
          <WalletTag name={row.toName} color={row.toColor} />
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
