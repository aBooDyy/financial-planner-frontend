import { Plus, X } from 'lucide-react'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { money } from '#/features/planning/view/format'
import { amountInputProps } from '#/lib/currency'
import { cn } from '#/lib/utils'

/** One `[wallet ▾] [amount]` row; `amount` is the typed text. */
export type SplitRow = { key: number; walletId: string; amount: string }

/** A split across wallets (03 §3): rows of wallet and amount, with what is left to place. */
export function SplitRows({
  rows,
  setRows,
  currency,
  wallets,
  left,
  label = 'Split across',
}: {
  rows: SplitRow[]
  setRows: (update: (rows: SplitRow[]) => SplitRow[]) => void
  currency: string
  wallets: ReadonlyArray<{ id: string; name: string; color: string }>
  /** What is still to place; omitted when the rows have no total to add up to. */
  left?: number
  label?: string
}) {
  const update = (key: number, patch: Partial<SplitRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-2">
          <Select
            value={r.walletId || undefined}
            onValueChange={(walletId) => update(r.key, { walletId })}
          >
            <SelectTrigger
              aria-label={`Wallet ${i + 1}`}
              className="min-w-0 flex-1"
            >
              <SelectValue placeholder="Pick a wallet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={`Amount ${i + 1}`}
            {...amountInputProps(currency, r.amount, (amount) =>
              update(r.key, { amount }),
            )}
            className="w-[120px] text-end tabular-nums"
          />
          <button
            type="button"
            aria-label={`Remove wallet ${i + 1}`}
            disabled={rows.length <= 1}
            onClick={() =>
              setRows((list) => list.filter((x) => x.key !== r.key))
            }
            className="flex size-8 flex-none items-center justify-center rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2 disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setRows((list) => [
              ...list,
              {
                key: Math.max(0, ...list.map((x) => x.key)) + 1,
                walletId: '',
                amount: '',
              },
            ])
          }
          className="flex items-center gap-1 text-[13px] font-bold text-fp-accent-ink"
        >
          <Plus size={14} /> Another wallet
        </button>
        {left === undefined ? null : (
          <span
            role="status"
            className={cn(
              'text-[12.5px] font-bold',
              left === 0 ? 'text-fp-accent-ink' : 'text-fp-warn',
            )}
          >
            {left === 0
              ? 'Adds up'
              : left > 0
                ? `${money(left, currency)} left to place`
                : `${money(-left, currency)} too much`}
          </span>
        )}
      </div>
    </div>
  )
}
