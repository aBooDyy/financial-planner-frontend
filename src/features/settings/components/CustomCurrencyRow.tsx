import { Pencil, Trash2 } from 'lucide-react'
import type { CurrencyRateRow } from '#/features/settings/hooks/useCurrencyRates'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  row: CurrencyRateRow
  base: CurrencyCode
  onEdit: () => void
  onDelete: () => void
}

const fmt = (n: number | null): string =>
  n === null
    ? '—'
    : n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })

const ICON =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text'

/** One of the user's own currencies. Its rate lives on the currency itself, so it is edited
 *  in the same dialog that named it rather than in a rate field. */
export function CustomCurrencyRow({ row, base, onEdit, onDelete }: Props) {
  const { code, meta, perBase, held } = row

  return (
    <div className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0">
      <div className="flex h-[30px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-fp-border bg-fp-surface-2 text-[12px] font-bold">
        {code}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] text-fp-text-2">
          {meta.name}
        </span>
        <span className="flex items-center gap-1.5 truncate text-[11.5px] text-fp-text-3">
          <span className="tabular-nums">
            1 {code} = {fmt(perBase)} {base}
          </span>
          {held ? (
            <span className="rounded-full bg-fp-surface-2 px-1.5 font-semibold">
              Held
            </span>
          ) : null}
        </span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${code}`}
        className={ICON}
      >
        <Pencil size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${code}`}
        className={`${ICON} hover:text-fp-danger`}
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  )
}
