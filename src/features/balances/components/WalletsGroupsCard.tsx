import { Plus } from 'lucide-react'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/balances/data/selectors'
import { GroupRow } from './GroupRow'
import { WalletRow } from './WalletRow'

type Props = {
  rows: BalanceRow[]
  onAddWallet: () => void
  onAddGroup: () => void
  /** Absent when there aren't two wallets to move money between. */
  onTransfer?: () => void
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddInside: (id: string) => void
  onOpenGoal: (goalId: string) => void
}

export function WalletsGroupsCard({
  rows,
  onAddWallet,
  onAddGroup,
  onTransfer,
  onToggle,
  onEdit,
  onDelete,
  onAddInside,
  onOpenGoal,
}: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex flex-col items-stretch gap-[10px] border-b border-fp-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold">Wallets &amp; groups</span>
          <span className="text-[12px] text-fp-text-3">
            Tap any wallet to edit · nest freely
          </span>
        </div>
        <div className="flex shrink-0 gap-2 max-sm:[&>*]:flex-1">
          <Button
            variant="outline"
            onClick={onAddGroup}
            className="gap-[5px] px-3 py-[9px] text-[13px] hover:border-fp-accent"
          >
            <Plus size={15} strokeWidth={2} />
            New group
          </Button>
          {onTransfer ? (
            <Button
              variant="outline"
              onClick={onTransfer}
              title="Transfer money between wallets"
              className="hidden gap-[5px] rounded-[11px] px-3 py-2 text-[13px] font-bold hover:border-fp-accent md:inline-flex"
            >
              <TransferGlyph size={15} strokeWidth={2} />
              Transfer
            </Button>
          ) : null}
          <Button
            onClick={onAddWallet}
            className="gap-[5px] px-[13px] py-[9px] text-[13px]"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add wallet
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-[14px] font-semibold text-fp-text">
            No wallets yet
          </p>
          <p className="mt-1 text-[13px] text-fp-text-3">
            Add a wallet or group to set your starting point.
          </p>
        </div>
      ) : (
        <div>
          {rows.map((row) =>
            row.kind === 'group' ? (
              <GroupRow
                key={row.id}
                row={row}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddInside={onAddInside}
              />
            ) : (
              <WalletRow
                key={row.id}
                row={row}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpenGoal={onOpenGoal}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
