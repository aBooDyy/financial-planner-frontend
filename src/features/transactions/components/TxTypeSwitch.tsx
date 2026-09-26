import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'
import { TYPE_LABEL, TYPE_TINT } from '#/features/transactions/data/txDialog'
import { cn } from '#/lib/utils'

type Props = {
  value: EditorTxType
  isLocked: (type: EditorTxType) => boolean
  onChange: (type: EditorTxType) => void
}

const TYPES: EditorTxType[] = ['spend', 'income', 'transfer']

/** Spend · Income · Transfer; the chosen one wears its type's tint. */
export function TxTypeSwitch({ value, isLocked, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Type"
      className="grid grid-cols-3 gap-1 rounded-full bg-fp-surface-2 p-1"
    >
      {TYPES.map((t) => {
        const active = t === value
        const locked = isLocked(t)
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={locked}
            title={
              locked
                ? 'A saved entry can’t switch between transfer and spend/income'
                : undefined
            }
            onClick={() => {
              if (!active) onChange(t)
            }}
            className={cn(
              'rounded-full px-[6px] py-[9px] text-[14px] transition disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'bg-fp-surface font-extrabold shadow-[0_1px_3px_rgba(20,18,12,0.10),0_0_0_1px_var(--fp-border)]'
                : 'font-semibold text-fp-text-2',
            )}
            style={active ? { color: TYPE_TINT[t].ink } : undefined}
          >
            {TYPE_LABEL[t]}
          </button>
        )
      })}
    </div>
  )
}
