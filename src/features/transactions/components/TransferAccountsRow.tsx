import type { LocalBalanceNode } from '#/db/types'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/lib/utils'

type Props = {
  wallets: LocalBalanceNode[]
  fromId: string
  toId: string
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onSwap: () => void
  invalid?: boolean
  /** The side whose account was deleted — shown, but no longer choosable. */
  missing?: 'from' | 'to'
  /** Quick add: round 30px swap, 44px selects. Otherwise the editor's labelled fields. */
  compact?: boolean
}

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

const NONE = '__none__'
const DELETED = '__deleted__'

function WalletSelect({
  wallets,
  value,
  onChange,
  label,
  invalid,
  deleted,
  compact,
}: {
  wallets: LocalBalanceNode[]
  value: string
  onChange: (id: string) => void
  label: string
  invalid?: boolean
  deleted?: boolean
  compact?: boolean
}) {
  const known = wallets.some((w) => w.id === value)
  const gone = deleted || (value !== '' && !known)
  return (
    <Select
      value={gone ? DELETED : known ? value : NONE}
      onValueChange={(v) => {
        if (v !== NONE && v !== DELETED) onChange(v)
      }}
      disabled={deleted}
    >
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-w-0',
          compact &&
            'h-full min-h-[44px] rounded-[11px] px-2 py-0 text-[13px] font-semibold',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!gone && !known ? (
          <SelectItem value={NONE}>Choose an account</SelectItem>
        ) : null}
        {gone ? <SelectItem value={DELETED}>Deleted account</SelectItem> : null}
        {wallets.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span
              className="h-[8px] w-[8px] flex-none rounded-[2px]"
              style={{ background: w.color }}
            />
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** From · swap · To. The swap glyph is point-symmetric, so it stays unmirrored in RTL. */
export function TransferAccountsRow({
  wallets,
  fromId,
  toId,
  onFrom,
  onTo,
  onSwap,
  invalid,
  missing,
  compact,
}: Props) {
  const side = (which: 'from' | 'to') => {
    const label = which === 'from' ? 'From' : 'To'
    const select = (
      <WalletSelect
        wallets={wallets}
        value={which === 'from' ? fromId : toId}
        onChange={which === 'from' ? onFrom : onTo}
        label={`${label} account`}
        invalid={invalid}
        deleted={missing === which}
        compact={compact}
      />
    )
    if (compact) return select
    return (
      <div className="min-w-0">
        <Label className={LABEL}>{label}</Label>
        {select}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
        compact ? 'h-full items-center gap-[6px]' : 'items-end gap-2',
      )}
    >
      {side('from')}
      <button
        type="button"
        onClick={onSwap}
        disabled={missing !== undefined}
        title="Swap accounts"
        aria-label="Swap accounts"
        className={cn(
          'flex flex-none cursor-pointer items-center justify-center border border-fp-border-strong bg-fp-surface text-fp-text-2 transition hover:border-fp-accent hover:text-fp-accent-ink disabled:cursor-not-allowed disabled:opacity-50',
          compact ? 'size-[30px] rounded-full' : 'h-[46px] w-9 rounded-[11px]',
        )}
      >
        <TransferGlyph size={compact ? 14 : 16} />
      </button>
      {side('to')}
    </div>
  )
}
