import { ArrowUp, ReceiptText, Repeat, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { money } from '#/features/planning/view/format'
import type { RowState } from '#/features/planning/view/upcoming'
import { cn } from '#/lib/utils'

const STATE_TONE: Record<RowState['tone'], string> = {
  ok: 'text-fp-accent-ink',
  warn: 'text-fp-warn',
  danger: 'text-fp-danger',
  muted: 'text-fp-text-3',
}

const TAG: Record<UpcomingRow['tag'], string> = {
  bill: 'Bill',
  goal: 'Goal',
  income: 'Income',
}

type Props = {
  row: UpcomingRow
  /** The bill's or goal's own name (a planned set-aside's row name carries a suffix). */
  name: string
  color: string
  meta: string
  /** Payments: the line under the amount. */
  state?: RowState
  autopay?: boolean
  /** "Pay now" / "Set aside now". */
  action?: { label: string; onClick: () => void; busy?: boolean }
  onOpen: () => void
}

/** One planned row in a pay period: icon tile, name + tag, meta, amount, an action. */
export function UpcomingRowItem({
  row,
  name,
  color,
  meta,
  state,
  autopay,
  action,
  onOpen,
}: Props) {
  const role = row.item.role
  const setAside = role === 'set_aside'
  const icon: ReactNode =
    role === 'income' ? (
      <ArrowUp size={15} strokeWidth={2.2} />
    ) : setAside ? (
      row.tag === 'goal' ? (
        <Target size={15} strokeWidth={2.2} />
      ) : (
        <Repeat size={15} strokeWidth={2.2} />
      )
    ) : (
      <ReceiptText size={15} strokeWidth={2.2} />
    )
  return (
    <li className="flex items-center gap-3 border-t border-fp-border px-4 py-[11px] first:border-t-0 hover:bg-fp-surface-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span
          aria-hidden
          className="flex size-[30px] flex-none items-center justify-center rounded-[9px]"
          style={{
            color,
            background: setAside
              ? 'var(--fp-transfer-soft)'
              : `color-mix(in srgb, ${color} 13%, transparent)`,
          }}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-[6px]">
            <span className="truncate text-[13.5px] font-semibold">{name}</span>
            <span className="flex-none rounded-full bg-fp-surface-2 px-[7px] py-px text-[10.5px] font-bold text-fp-text-2">
              {TAG[row.tag]}
            </span>
            {autopay ? (
              <span className="flex-none rounded-full bg-fp-surface-2 px-[7px] py-px text-[10.5px] font-bold text-fp-text-2">
                Auto-pay
              </span>
            ) : null}
          </span>
          <span className="fp-sensitive block truncate text-[11.5px] text-fp-text-3">
            {meta}
          </span>
        </span>
      </button>
      {action ? (
        <button
          type="button"
          disabled={action.busy}
          onClick={action.onClick}
          className="flex-none rounded-[9px] border border-fp-border px-[10px] py-[6px] text-[12px] font-bold text-fp-accent-ink hover:border-fp-border-strong disabled:opacity-50"
        >
          {action.label}
        </button>
      ) : null}
      <span className="flex flex-none flex-col items-end">
        <span
          className={cn(
            'fp-sensitive text-[13.5px] font-bold tabular-nums',
            setAside && 'text-fp-transfer',
            role === 'income' && 'text-fp-accent-ink',
          )}
        >
          {role === 'income' ? '+' : ''}
          {money(row.remainder, row.currency)}
        </span>
        {state ? (
          <span className={cn('text-[11px] font-bold', STATE_TONE[state.tone])}>
            {state.label}
          </span>
        ) : null}
      </span>
    </li>
  )
}
