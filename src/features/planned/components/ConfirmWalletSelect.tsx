import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalBalanceNode } from '#/db/types'
import { EXTERNAL } from '#/features/planned/hooks/useConfirmForm'

type Props = {
  id: string
  label: string
  wallets: ReadonlyArray<LocalBalanceNode>
  value: string
  /** Offers "External…" — money held outside any wallet (set-asides only). */
  allowExternal: boolean
  onChange: (source: string) => void
}

const NONE = '__none__'

/** Where a confirmed item's money came from or went: a wallet, or somewhere external. */
export function ConfirmWalletSelect({
  id,
  label,
  wallets,
  value,
  allowExternal,
  onChange,
}: Props) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
    >
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {wallets.length === 0 ? (
          <SelectItem value={NONE}>No wallets yet</SelectItem>
        ) : null}
        {wallets.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span
              aria-hidden
              className="size-[10px] flex-none rounded-[3px]"
              style={{ background: w.color }}
            />
            <span className="truncate">{w.name}</span>
          </SelectItem>
        ))}
        {allowExternal ? (
          <SelectItem value={EXTERNAL}>External…</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}
