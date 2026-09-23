import { useVirtualRows } from '#/hooks/useVirtualRows'
import type { CurrencyRateRow } from '#/features/settings/hooks/useCurrencyRates'
import type { CurrencyCode } from '#/lib/currency'
import { RATE_ROW_HEIGHT, RateRow } from './RateRow'

/** Tall enough to show a useful slice of the table without owning the whole page. */
const LIST_HEIGHT = 460

type Props = {
  rows: CurrencyRateRow[]
  base: CurrencyCode
  onCommit: (code: CurrencyCode, perBase: number) => void
  onReset: (code: CurrencyCode) => void
}

/**
 * Every currency, windowed. The table is ~150 rows and each carries an input, so rendering
 * all of them costs more than the screen is worth — only what fits is mounted, and the rest
 * is two spacers.
 */
export function RateList({ rows, base, onCommit, onReset }: Props) {
  const virtual = useVirtualRows({
    count: rows.length,
    rowHeight: RATE_ROW_HEIGHT,
  })

  if (rows.length === 0) {
    return (
      <p className="px-[18px] py-[15px] text-[13px] text-fp-text-3">
        No currency matches.
      </p>
    )
  }

  return (
    <div
      ref={virtual.ref}
      onScroll={virtual.onScroll}
      style={{ maxHeight: LIST_HEIGHT }}
      className="overflow-y-auto"
    >
      <div style={{ height: virtual.padStart }} />
      {rows.slice(virtual.first, virtual.last).map((row) => (
        <RateRow
          key={row.code}
          row={row}
          base={base}
          onCommit={(perBase) => onCommit(row.code, perBase)}
          onReset={() => onReset(row.code)}
        />
      ))}
      <div style={{ height: virtual.padEnd }} />
    </div>
  )
}
