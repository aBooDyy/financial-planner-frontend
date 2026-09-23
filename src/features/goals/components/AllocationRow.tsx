import { X } from 'lucide-react'
import type { walletGroupOptions } from '#/features/balances/data/selectors'
import type { AllocationRowDraft } from '#/features/goals/hooks/useGoalEditor'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export type WalletGroup = ReturnType<typeof walletGroupOptions>[number]

const ALLOC_INPUT =
  'rounded-[9px] border border-fp-border-strong bg-fp-surface px-2.5 py-2 text-[13px] text-fp-text outline-none focus:border-fp-accent'

type Props = {
  row: AllocationRowDraft
  over: boolean
  walletGroups: WalletGroup[]
  onSource: (key: string, value: string) => void
  onField: (
    key: string,
    field: 'amount' | 'externalLabel',
    value: string,
  ) => void
  onRemove: (key: string) => void
}

export function AllocationRow({
  row,
  over,
  walletGroups,
  onSource,
  onField,
  onRemove,
}: Props) {
  const sourceValue =
    row.source === 'wallet' ? (row.walletId ?? 'external') : 'external'
  return (
    <div
      className={`rounded-[11px] border bg-fp-surface-2 p-2.5 ${
        over ? 'border-fp-danger' : 'border-fp-border-strong'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="relative w-[40%]">
          <Input
            value={row.amount}
            onChange={(e) => onField(row.key, 'amount', e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className={`${ALLOC_INPUT} h-auto bg-fp-surface pe-10 tabular-nums`}
          />
          <span className="pointer-events-none absolute inset-y-0 inset-e-2.5 flex items-center text-[11px] font-semibold text-fp-text-3">
            {row.currency}
          </span>
        </div>
        <Select value={sourceValue} onValueChange={(v) => onSource(row.key, v)}>
          <SelectTrigger className={`${ALLOC_INPUT} h-auto min-w-0 flex-1`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {walletGroups.map((g, gi) => (
              <SelectGroup key={gi}>
                <SelectLabel>{g.label ?? 'Wallets'}</SelectLabel>
                {g.wallets.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            <SelectItem value="external">External source…</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onRemove(row.key)}
          aria-label="Remove source"
          className="h-8 w-8 flex-none rounded-[9px] bg-fp-surface text-fp-text-3 hover:text-fp-danger"
        >
          <X size={15} strokeWidth={2} />
        </Button>
      </div>
      {row.source === 'external' ? (
        <Input
          value={row.externalLabel}
          onChange={(e) => onField(row.key, 'externalLabel', e.target.value)}
          placeholder="Source name — e.g. Dad’s help, Grant"
          className={`${ALLOC_INPUT} mt-2 h-auto w-full bg-fp-surface`}
        />
      ) : null}
    </div>
  )
}
