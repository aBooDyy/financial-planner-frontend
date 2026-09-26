import type { LocalInboundImport } from '#/db/types'
import { parseISODate } from '#/lib/date'
import { formatMoney } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { TxType } from '#/features/transactions/api/types'
import { fmtShort } from '#/features/transactions/data/planning'
import { SourceChip } from './SourceChip'

type Props = {
  item: LocalInboundImport
  title: string
  type: TxType
  /** The draft's amount in minor units, or null while there is none to show. */
  amountMinor: number | null
  currency: CurrencyCode
}

const dayOf = (iso: string | null): string | null => {
  const day = iso ? parseISODate(iso) : null
  return day ? fmtShort(day) : iso
}

/** Who it is, where it came from and when — with the amount, or what is missing instead. */
export function PendingImportHeader({
  item,
  title,
  type,
  amountMinor,
  currency,
}: Props) {
  const day = dayOf(item.occurredOn)
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-fp-surface-2 text-[15px] font-extrabold text-fp-text-2 uppercase"
      >
        {title.trim().charAt(0) || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-extrabold">{title}</div>
        <div className="flex min-w-0 items-center gap-[5px] text-[12px] text-fp-text-3">
          <SourceChip source={item.source} />
          <span className="truncate">
            {item.sourceLabel ?? item.sourceRef}
            {day ? ` · ${day}` : ''}
          </span>
        </div>
      </div>
      {amountMinor != null && amountMinor > 0 ? (
        <span className="flex-none text-[15px] font-extrabold tabular-nums">
          {type === 'spend' ? '− ' : '+ '}
          {formatMoney(amountMinor, currency)}
        </span>
      ) : (
        <span className="flex-none rounded-full bg-fp-danger/10 px-2 py-[2px] text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap text-fp-danger uppercase">
          Needs details
        </span>
      )}
    </div>
  )
}
