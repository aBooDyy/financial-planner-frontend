import { ReceiptText } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { dayMonth, money } from '#/features/planning/view/format'

type Props = {
  rows: ReadonlyArray<UpcomingRow>
  nameOf: (row: UpcomingRow) => string
  busyId: string | null
  onOpen: (row: UpcomingRow) => void
  onConfirm: (row: UpcomingRow) => void
  onSkip: (row: UpcomingRow) => void
}

/** Needs confirming: planned rows whose date has come — did they happen? */
export function NeedsConfirmingBand({
  rows,
  nameOf,
  busyId,
  onOpen,
  onConfirm,
  onSkip,
}: Props) {
  if (rows.length === 0) return null
  return (
    <section
      aria-label="Needs confirming"
      className="overflow-hidden rounded-[16px] border border-fp-warn/30 bg-fp-warn/10"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span aria-hidden className="size-[7px] rounded-full bg-fp-warn" />
        <span className="text-[12px] font-extrabold tracking-[0.05em] text-fp-warn uppercase">
          Needs confirming
        </span>
        <span className="text-[12px] font-bold text-fp-warn tabular-nums">
          {rows.length}
        </span>
        <span className="ms-auto text-[12px] text-fp-text-2">
          Did these happen?
        </span>
      </div>
      <ul>
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 border-t border-fp-warn/25 px-4 py-[10px]"
          >
            <button
              type="button"
              onClick={() => onOpen(r)}
              className="flex min-w-0 flex-1 items-center gap-3 text-start"
            >
              <span
                aria-hidden
                className="flex size-[30px] flex-none items-center justify-center rounded-full bg-fp-surface text-fp-warn"
              >
                <ReceiptText size={14} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {nameOf(r)}
                </span>
                <span className="block truncate text-[11.5px] text-fp-text-2">
                  {[`Was due ${dayMonth(r.item.date)}`, r.walletName]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="fp-sensitive text-[13.5px] font-bold tabular-nums">
                {money(r.remainder, r.currency)}
              </span>
            </button>
            <div className="flex w-full justify-end gap-2 md:w-auto">
              <Button
                type="button"
                variant="quiet"
                size="sm"
                disabled={busyId === r.id}
                onClick={() => onSkip(r)}
                className="rounded-[9px] text-[12px]"
              >
                Skip
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busyId === r.id}
                onClick={() => onConfirm(r)}
                className="rounded-[9px] text-[12px]"
              >
                Confirm
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
