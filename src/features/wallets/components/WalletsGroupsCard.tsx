import { Link } from '@tanstack/react-router'
import { Archive, ChevronRight, Plus, Wallet } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/wallets/data/selectors'
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
  onAdjust: (id: string) => void
  onDelete: (id: string) => void
  onAddInside: (id: string) => void
  onOpenGoal: (goalId: string) => void
  archivedCount: number
}

export function WalletsGroupsCard({
  rows,
  onAddWallet,
  onAddGroup,
  onTransfer,
  onToggle,
  onEdit,
  onAdjust,
  onDelete,
  onAddInside,
  onOpenGoal,
  archivedCount,
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
        <EmptyState
          icon={Wallet}
          title="No wallets yet"
          text="Add a wallet or group to set your starting point."
          action={{ label: 'Add wallet', onClick: onAddWallet }}
        />
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
                onAdjust={onAdjust}
                onDelete={onDelete}
                onOpenGoal={onOpenGoal}
              />
            ),
          )}
        </div>
      )}

      {archivedCount > 0 ? (
        <Link
          to="/settings/archived"
          className="flex items-center gap-2 px-4 py-3 text-[12.5px] font-semibold text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text"
        >
          <Archive size={14} strokeWidth={1.9} />
          <span className="flex-1">{archivedCount} archived</span>
          <ChevronRight size={15} strokeWidth={2} className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  )
}
