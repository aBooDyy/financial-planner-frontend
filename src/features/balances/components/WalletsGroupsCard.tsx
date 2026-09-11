import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/balances/data/selectors'
import { GroupRow } from './GroupRow'
import { WalletRow } from './WalletRow'

type Props = {
  rows: BalanceRow[]
  onAddWallet: () => void
  onAddGroup: () => void
  onToggle: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddInside: (id: string) => void
}

export function WalletsGroupsCard({
  rows,
  onAddWallet,
  onAddGroup,
  onToggle,
  onEdit,
  onDelete,
  onAddInside,
}: Props) {
  // Which wallets have their reservation breakdown expanded (UI-only, not persisted).
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleReservations = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border p-4">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Wallets &amp; groups</span>
          <span className="text-[12px] text-fp-text-3">
            Tap any wallet to edit · nest freely
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onAddGroup}
            className="gap-[5px] px-3 py-[9px] text-[13px] hover:border-fp-accent"
          >
            <Plus size={15} strokeWidth={2} />
            New group
          </Button>
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
                expanded={expanded.has(row.id)}
                onToggleReservations={toggleReservations}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
