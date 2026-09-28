import type { LocalBalanceNode } from '#/db/types'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { WalletSelectSections } from '#/features/wallets/components/WalletSelectSections'
import { sectionByGroup } from '#/features/wallets/data/walletSections'
import type { WalletSection } from '#/features/wallets/data/walletSections'
import { useWalletGroups } from '#/features/wallets/hooks/useWalletGroups'

type Props = {
  wallets: LocalBalanceNode[]
  fromId: string
  toId: string
  onFrom: (id: string) => void
  onTo: (id: string) => void
  onSwap: () => void
  invalid?: boolean
}

const NONE = '__none__'
const DELETED = '__deleted__'

function WalletSelect({
  wallets,
  sections,
  value,
  onChange,
  label,
  invalid,
}: {
  wallets: LocalBalanceNode[]
  sections: WalletSection<LocalBalanceNode>[]
  value: string
  onChange: (id: string) => void
  label: string
  invalid?: boolean
}) {
  const known = wallets.some((w) => w.id === value)
  const gone = value !== '' && !known
  return (
    <Select
      value={gone ? DELETED : known ? value : NONE}
      onValueChange={(v) => {
        if (v !== NONE && v !== DELETED) onChange(v)
      }}
    >
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="h-full min-h-[44px] min-w-0 rounded-[11px] px-2 py-0 text-[13px] font-semibold"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!gone && !known ? (
          <SelectItem value={NONE}>Choose an account</SelectItem>
        ) : null}
        {gone ? <SelectItem value={DELETED}>Deleted account</SelectItem> : null}
        <WalletSelectSections
          sections={sections}
          renderItem={(w) => (
            <SelectItem key={w.id} value={w.id}>
              <span
                className="h-[8px] w-[8px] flex-none rounded-[2px]"
                style={{ background: w.color }}
              />
              {w.name}
            </SelectItem>
          )}
        />
      </SelectContent>
    </Select>
  )
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
  const sections = sectionByGroup(useWalletGroups(), wallets)
  const side = (which: 'from' | 'to') => (
    <WalletSelect
      wallets={wallets}
      sections={sections}
      value={which === 'from' ? fromId : toId}
      onChange={which === 'from' ? onFrom : onTo}
      label={`${which === 'from' ? 'From' : 'To'} account`}
      invalid={invalid}
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
