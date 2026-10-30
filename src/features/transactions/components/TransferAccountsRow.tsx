import type { LocalBalanceNode } from '#/db/types'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import { AccountSelect } from './AccountSelect'

type Props = {
  wallets: LocalBalanceNode[]
  fromId: string
  toId: string
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onSwap: () => void
  invalid?: boolean
}

/** Quick add's From · swap · To. The swap glyph is point-symmetric, so it stays unmirrored in RTL. */
export function TransferAccountsRow({
  wallets,
  fromId,
  toId,
  onFrom,
  onTo,
  onSwap,
  invalid,
}: Props) {
  const side = (which: 'from' | 'to') => (
    <AccountSelect
      label={`${which === 'from' ? 'From' : 'To'} account`}
      wallets={wallets}
      value={which === 'from' ? fromId : toId}
      onChange={which === 'from' ? onFrom : onTo}
      placeholder="Choose an account"
      invalid={invalid}
      className="h-full min-h-[44px] min-w-0 gap-[6px] rounded-[11px] px-2 py-0 text-[13px] font-semibold"
    />
  )

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[6px]">
      {side('from')}
      <button
        type="button"
        onClick={onSwap}
        title="Swap accounts"
        aria-label="Swap accounts"
        className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-full border border-fp-border-strong bg-fp-surface text-fp-text-2 transition hover:border-fp-accent hover:text-fp-accent-ink"
      >
        <TransferGlyph size={14} />
      </button>
      {side('to')}
    </div>
  )
}
